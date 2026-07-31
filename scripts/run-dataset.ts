/**
 * Run the hosted Langfuse dataset against the live agent.
 *
 * For each item in the dataset:
 *   1. Call the same runSupportConversation(...) the web app uses.
 *   2. Roll the per-item traces into one experiment run row.
 *   3. Attach a deterministic keyword_overlap score per item.
 *   4. Attach an LLM-as-a-judge correctness score per item.
 *
 * Usage:
 *   npm run dataset:run
 */
import "../src/server/load-env";

// --- 1. Boot the OpenTelemetry SDK so every observe(...) call inside
//        the agent emits spans to Langfuse, exactly like the live server.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { randomUUID } from "node:crypto";
import { LangfuseClient } from "@langfuse/client";
import { observeOpenAI } from "@langfuse/openai";
import type { ChatMessage } from "../src/shared/types";
import { env } from "../src/server/env";
import { createOpenAIClient } from "../src/server/openai-client";
import { runSupportConversation } from "../src/server/support-agent";

const langfuseSpanProcessor = new LangfuseSpanProcessor();
const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();

// --- 2. Dataset item shape (must match data/seed-dataset.json).
type DatasetInput = {
  messages: Array<{
    role: ChatMessage["role"];
    content: string;
  }>;
};

type DatasetExpectation = {
  idealAnswer: string;
  expectedKeywords: string[];
};

type CorrectnessJudgeResult = {
  score: number;
  reason: string;
};

// --- 3. The deterministic evaluator.
//        Fraction of expected keywords that show up (case-insensitive)
//        in the agent's answer. 1 means every expected keyword landed;
//        0 means none did.
function keywordOverlap(answer: string, expectedKeywords: string[]) {
  if (expectedKeywords.length === 0) {
    return 1;
  }

  const normalizedAnswer = answer.toLowerCase();
  const matches = expectedKeywords.filter((keyword) =>
    normalizedAnswer.includes(keyword.toLowerCase())
  );

  return matches.length / expectedKeywords.length;
}

// --- 4. The LLM-as-a-judge evaluator.
//        This one is semantic: it asks a judge model whether the agent's
//        actual answer correctly matches the dataset's ideal answer.
async function judgeCorrectness(args: {
  query: string;
  actualAnswer: string;
  idealAnswer: string;
}): Promise<CorrectnessJudgeResult> {
  // Reuse the same Azure/OpenAI provider factory as the app, then wrap it so
  // the judge model call is observable too.
  const openai = observeOpenAI(createOpenAIClient());

  // Ask for JSON so the experiment runner can turn the judge response into
  // a numeric Langfuse score and a short explanation comment.
  const response = await openai.chat.completions.create({
    model: env.chatModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an evaluator for a Dad IT support agent.
Compare the user's question, the agent's actual answer, and the ideal answer.
Return JSON only with:
- "score": 1 if the actual answer is correct and meaningfully matches the ideal answer, otherwise 0.
- "reason": one short sentence explaining the score.`
      },
      {
        role: "user",
        content: JSON.stringify(args)
      }
    ]
  });

  const content = response.choices[0]?.message.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<CorrectnessJudgeResult>;

  return {
    score: parsed.score === 1 ? 1 : 0,
    reason: parsed.reason ?? "The judge did not return a reason."
  };
}

// Convert a dataset item's messages array into the ChatMessage shape
// the live server uses (adds id + timestamp on each message).
function toRuntimeMessages(input: DatasetInput) {
  return input.messages.map((message, index) => ({
    id: `dataset-message-${index + 1}`,
    role: message.role,
    content: message.content,
    timestamp: new Date().toISOString()
  }));
}

async function main() {
  if (!env.langfusePublicKey || !env.langfuseSecretKey) {
    throw new Error("Langfuse credentials are required to run dataset experiments.");
  }

  // --- 5. Pull the hosted dataset by DATASET_NAME from .env.
  const langfuse = new LangfuseClient({
    publicKey: env.langfusePublicKey,
    secretKey: env.langfuseSecretKey,
    baseUrl: env.langfuseBaseUrl
  });

  const dataset = await langfuse.dataset.get(env.datasetName);
  const runName = `dad-it-support-${new Date().toISOString()}`;

  // --- 6. runExperiment iterates the dataset, calls `task` for each
  //        item, and records every per-item trace + score under a
  //        single run row identified by `runName`.
  const result = await dataset.runExperiment({
    name: "Dad IT Support Agent experiment",
    runName,
    description: "Workshop dataset run for the Dad IT Support Agent",
    metadata: {
      model: env.chatModel,
      provider: env.openaiProvider
    },
    maxConcurrency: 1,
    // `task` runs the agent on one dataset item. The return value
    // becomes the experiment item's `output` and is what the
    // evaluators below score.
    task: async (item) => {
      const input = item.input as DatasetInput;
      const response = await runSupportConversation({
        sessionId: `dataset-${randomUUID()}`,
        userId: "dataset-runner",
        messages: toRuntimeMessages(input)
      });

      return response.answer;
    },
    // Each evaluator returns a Langfuse score attached to the dataset run item.
    // keyword_overlap is deterministic and cheap; correctness is semantic and
    // uses one extra judge-model call per dataset item.
    evaluators: [
      async ({ output, expectedOutput }) => {
        const expected = expectedOutput as DatasetExpectation;
        const overlap = keywordOverlap(output as string, expected.expectedKeywords);

        return {
          name: "keyword_overlap",
          value: overlap,
          comment: `Matched ${Math.round(
            overlap * expected.expectedKeywords.length
          )} of ${expected.expectedKeywords.length} expected keywords.`
        };
      },
      async ({ input, output, expectedOutput }) => {
        const datasetInput = input as DatasetInput;
        const expected = expectedOutput as DatasetExpectation;
        const query = datasetInput.messages.at(-1)?.content ?? "";

        // The judge compares the user's question, the agent's answer from
        // `task`, and the ideal answer stored in the dataset item.
        const judged = await judgeCorrectness({
          query,
          actualAnswer: output as string,
          idealAnswer: expected.idealAnswer
        });

        return {
          name: "correctness",
          value: judged.score,
          comment: judged.reason
        };
      }
    ]
  });

  // --- 7. Pretty-print the summary table and flush any pending spans
  //        before the process exits.
  console.log(await result.format());
  await langfuse.flush();
  await langfuseSpanProcessor.forceFlush();
  await sdk.shutdown();
}

void main();
