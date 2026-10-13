import OpenAI from "openai";
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

// Run the local TypeScript function selected by the model.
export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  // The model supplies a tool name; this switch decides which local function actually runs.
  switch (name) {
    case "get_support_context": {
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
    }
    case "search_help_library": {
      // Normalize model input, search the local guides, and return only useful fields.
      const guides = searchGuides(String(input.question ?? ""));
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
    }
    default:
      // Never execute arbitrary names supplied by the model.
      return { ok: false, error: `Unsupported tool: ${name}` };
  }
}
