import OpenAI from "openai";
import { getSupportContext, searchGuides } from "./support-data";
import { observe } from "@langfuse/tracing";

type ToolResult = Record<string, unknown>;

// JSON schemas sent to the model so it knows which tools exist and how to call them.
// They describe possible requests; the TypeScript implementations appear below.
export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_support_context",
      description: "Look up Dad's known device setup so the answer stays grounded.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_help_library",
      description: "Search the local help library for practical step-by-step device instructions.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Dad's practical device question."
          }
        },
        required: ["question"],
        additionalProperties: false
      }
    }
  }
];

// Traced version of the context lookup tool. Langfuse records its input/output as a tool observation.
const getSupportContextTool = observe(
  async () => {
    const context = getSupportContext();

    // Return only the profile fields that help the model answer the current question.
    return {
      ok: true,
      context: {
        id: context.id,
        label: context.label,
        devices: context.devices,
        deviceSummary: context.deviceSummary,
        responseStyle: context.responseStyle,
        scopeHighlights: context.scopeHighlights,
        notableApps: context.notableApps
      }
    };
  },
  { name: "get_support_context", asType: "tool" }
);

// Traced version of the help-library search tool. The input question appears in the tool span.
const searchHelpLibraryTool = observe(
  async (input: { question: string }) => {
    const guides = searchGuides(input.question);

    // Convert internal guide objects into a compact, model-facing result.
    return {
      ok: true,
      results: guides.map((guide) => ({
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        steps: guide.steps,
        caution: guide.caution ?? null
      }))
    };
  },
  { name: "search_help_library", asType: "tool" }
);

// Dispatch the tool call requested by the model to the matching local implementation.
export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  // The model supplies a tool name; this switch decides which local function actually runs.
  switch (name) {
    case "get_support_context":
      return getSupportContextTool();

    case "search_help_library":
      // Normalize unknown model input to the string expected by the search helper.
      return searchHelpLibraryTool({ question: String(input.question ?? "") });

    default:
      // Never execute arbitrary names supplied by the model.
      return { ok: false, error: `Unsupported tool: ${name}` };
  }
}
