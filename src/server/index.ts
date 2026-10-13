import "./load-env";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ChatRequest } from "../shared/types";
import { runSupportConversation } from "./support-agent";
import { env, isLangfuseConfigured } from "./env";
import { DEFAULT_SUPPORT_CONTEXT } from "./support-data";

// Start OpenTelemetry before requests arrive so Langfuse can receive every span.
const langfuseSpanProcessor = new LangfuseSpanProcessor();
const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();

// Validate the browser payload before passing it to the agent.
// Zod rejects malformed requests before they can reach the model or tools.
const requestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.union([z.literal("user"), z.literal("assistant")]),
        content: z.string().min(1),
        timestamp: z.string()
      })
    )
    .min(1)
});

const app = express();

// Parse JSON request bodies while preventing unexpectedly large payloads.
app.use(express.json({ limit: "1mb" }));

// Report the active provider and whether Langfuse credentials are present.
app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    provider: env.openaiProvider,
    tracingConfigured: isLangfuseConfigured()
  });
});

// Return the fixed Dad/iPhone context used by the local tools.
app.get("/api/support-context", (_request, response) => {
  response.json(DEFAULT_SUPPORT_CONTEXT);
});

// Validate one chat request, run the agent, and return its answer.
app.post("/api/chat", async (request, response) => {
  try {
    // Convert unknown request data into the ChatRequest shape used by the agent.
    const payload = requestSchema.parse(request.body) as ChatRequest;
    const result = await runSupportConversation(payload);
    response.json(result);
  } catch (error) {
    // Return validation and provider errors to the browser as readable messages.
    const message = error instanceof Error ? error.message : "Unknown server error";
    response.status(400).send(message);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Resolve dist relative to this file in both development and compiled builds.
const clientDist = path.resolve(currentDir, "../../dist");

// Serve the built browser application when running the production server.
app.use(express.static(clientDist));
app.use((_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(env.port, "127.0.0.1", () => {
  console.log(`Dad IT Support Agent server listening on http://127.0.0.1:${env.port}`);
});

// Flush pending spans before Node exits so the final trace is not lost.
async function shutdown() {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await langfuseSpanProcessor.forceFlush();
  await sdk.shutdown();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
