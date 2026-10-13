import OpenAI from "openai";
import type { ChatMessage, ChatRequest, ChatResponse } from "../shared/types";
import { env } from "./env";
import { createOpenAIClient } from "./openai-client";
import { getSupportContext } from "./support-data";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

// This local prompt defines the agent's role and behaviour before prompt management is added.
export const SYSTEM_PROMPT = `You are Dad IT Support Agent.
You are talking directly to Dad. He opened this chat himself to get help with his iPhone.

You do not yet know which iPhone Dad has or which apps he uses — call get_support_context to find out before giving any device-specific instructions.

Rules:
- Speak directly to Dad in second person ("you", "your iPhone"). Never refer to Dad in the third person.
- Call get_support_context as your very first tool call on each turn so you know which iPhone, iOS, and apps Dad has.
- For step-by-step help, call search_help_library before giving the final answer.
- Use short numbered steps with one action per line.
- Mention what Dad should expect to see on his screen after important taps.
- Be honest about limits. You cannot see his screen, passwords, or real-time location.
- If the request is out of scope, say so kindly and redirect to the closest iPhone-help you can give.
- Do not invent button names or settings paths that were not confirmed by tool results.
`;

// Remove UI-only fields before sending the conversation to the model.
function toOpenAIMessages(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

// Read the plain-text final answer from the model response.
function readAssistantText(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  return "";
}

// Parse and validate the JSON arguments supplied with a model tool call.
function parseToolArguments(argumentsText: string) {
  try {
    const parsed = JSON.parse(argumentsText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return null;
  }
}

// Run one complete chat turn, including any tool calls requested by the model.
export async function runSupportConversation(request: ChatRequest): Promise<ChatResponse> {
  // Load context for response metadata and create the configured provider client.
  const context = getSupportContext();
  const openai = createOpenAIClient();

  // The transcript is the complete message history sent back to the model on every loop.
  const transcript: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...toOpenAIMessages(request.messages)
  ];

  // Track tool names for the API response and hold the eventual model answer.
  const usedTools = new Set<string>();
  let finalAnswer = "";

  // Repeat until the model returns a final answer instead of another tool call.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    // Give the model the conversation plus the schemas of tools it may request.
    const response = await openai.chat.completions.create({
      model: env.chatModel,
      // GPUStack may default to SSE; this workflow expects one JSON response.
      stream: false,
      messages: transcript,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto"
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("OpenAI returned no assistant message.");
    }

    // Keep the assistant message because later tool results must follow it in the transcript.
    transcript.push(message as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    const toolCalls = message.tool_calls ?? [];

    // No tool request means the assistant message is the final user-facing answer.
    if (toolCalls.length === 0) {
      finalAnswer = readAssistantText(message);
      break;
    }

    // Execute each requested local tool and append its result to the transcript.
    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      usedTools.add(toolCall.function.name);
      const parsedArguments = parseToolArguments(toolCall.function.arguments);
      const result =
        parsedArguments === null
          ? { ok: false, error: `The tool arguments for ${toolCall.function.name} were not valid JSON.` }
          : await executeTool(toolCall.function.name, parsedArguments);
      transcript.push({
        role: "tool",
        // This ID links the result to the exact tool call that requested it.
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  // Protect against an endless tool loop by returning a helpful fallback after six attempts.
  if (!finalAnswer) {
    finalAnswer =
      "I ran out of room before finishing that answer. Please ask the question once more in a slightly shorter way.";
  }

  // Return the answer, tool summary, and small debugging payload expected by the API route.
  return {
    answer: finalAnswer,
    usedTools: [...usedTools],
    traceMeta: {
      contextId: context.id,
      contextLabel: context.label,
      model: env.chatModel
    }
  };
}
