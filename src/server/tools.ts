import OpenAI from "openai";
import { observe } from "@langfuse/tracing";
import { getSupportContext, searchGuides } from "./support-data";

type ToolResult = Record<string, unknown>;

// Describe the available tools to the model, including their expected arguments.
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

// Record the context lookup input/output as a Langfuse tool observation.
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

// Record the help-library search input/output as a Langfuse tool observation.
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

// Route the model's requested tool name to the matching observed implementation.
export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  // The model supplies a tool name; this switch decides which local function actually runs.
  switch (name) {
    case "get_support_context": {
      return getSupportContextTool();
    }
    case "search_help_library": {
      // Normalize unknown model input to the string expected by the search helper.
      return searchHelpLibraryTool({ question: String(input.question ?? "") });
    }
    default:
      // Never execute arbitrary names supplied by the model.
      return { ok: false, error: `Unsupported tool: ${name}` };
  }
}
