---
title: "Workshop: Tracing an LLM Agent with Langfuse"
description: "Instrument the support agent so one chat turn becomes a Langfuse trace with OpenAI generations, agent observations, and tool calls."
---

# 02 Tracing

## Starting point

```bash
git checkout checkpoint/02-tracing
```

This is the blank slate for the tracing step — same code as `checkpoint/01-base-app`, with no Langfuse wiring yet. The Langfuse packages are already in `package.json` — run `npm install` if you haven't. Make sure `.env` has either your OpenAI Platform values or your Azure OpenAI values, plus your Langfuse keys.

## Why we trace

LLM apps are harder to debug than normal deterministic code because the model can make different decisions depending on the input, prompt, tools, and context. If we only look at the final answer, we cannot easily see why the agent behaved the way it did.

A Langfuse trace gives us a step-by-step record of one chat turn. In this workshop, one trace should show:

- the user's question,
- each OpenAI/Azure OpenAI model call,
- each local tool call,
- the data returned by those tools,
- and the final answer sent back to the user.

Langfuse calls the individual steps inside a trace **observations**. For example, a model call is a `generation`, and a tool execution is a `tool` observation. This makes the trace readable as a timeline of what happened during the agent run.

If you want the bigger-picture motivation, see the [Langfuse Academy lesson on tracing](https://langfuse.com/academy/tracing). If you want the technical details (SDK options, OpenTelemetry internals, span attributes), the [tracing docs](https://langfuse.com/docs/tracing) cover that.

## Goal

When Dad asks "How do I turn Bluetooth on?", the agent doesn't just hit OpenAI once. Behind the scenes it asks OpenAI what to do, calls `get_support_context` to fetch Dad's iPhone setup, asks OpenAI again, calls `search_help_library` for Bluetooth steps, then asks OpenAI one more time to produce the numbered answer. 

The goal of this chapter is to make every one of those steps visible in Langfuse — one chat turn becomes one trace, with the agent run, the OpenAI generations, and the two tool calls all logged in order.

![Spec's step by step process](../images/tracing/process_illustration.png)

We will build up the trace in three steps that mirror the agent's structure:

1. **Trace the model call** — record each OpenAI/Azure OpenAI request and response in Langfuse. This shows what messages were sent to the model, which model was used, and what the model returned.
2. **Wrap the full chat turn** — group the whole user message -> agent answer flow into one Langfuse trace. Inside that trace, Langfuse shows the model call and, later, the tool calls as child observations.
3. **Trace the tool calls** — record the local TypeScript functions the model asked the app to run, including their inputs and returned data.


## Step 1 — Trace the model call

We want observability on the OpenAI/Azure OpenAI calls themselves: what messages were sent, what the model returned, which model was used, and how much time and token usage the call took.

There are two parts to this step:

- `index.ts` starts the tracing pipeline for the backend server.
- `support-agent.ts` wraps the OpenAI-compatible client so model calls are recorded.

### `src/server/index.ts`

First, start the tracing pipeline for the backend server.

Add these imports near the top of the file, after the existing imports:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
```

Then create and start the SDK near the top level of the file, before the Express routes are defined:

```ts
const langfuseSpanProcessor = new LangfuseSpanProcessor();
const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();
```

This connects the backend process to Langfuse. The `NodeSDK` starts OpenTelemetry tracing for this Node server, and the `LangfuseSpanProcessor` sends the recorded spans to your Langfuse project.

Without this setup, the app can still call the model, but Langfuse has nowhere to receive the trace data from this process.

The processor reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` from the Node process environment. In this workshop, the server loads the repository `.env` before the Langfuse SDK starts, so edit `.env` instead of relying on exported shell values.

Also update the shutdown function so pending traces are flushed before the server exits:

```ts
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
```

This matters in local development because traces are sent in the background. If you stop the dev server immediately after a chat turn, flushing makes sure the last trace is sent to Langfuse before Node exits.

### `src/server/support-agent.ts`

Now that the server knows how to send traces to Langfuse, we need to create something useful to trace.

`support-agent.ts` is the file that contains the actual agent logic. It builds the system prompt, sends messages to the OpenAI-compatible client, reads any tool calls requested by the model, executes those tools, and finally returns the assistant answer to the Express route in `index.ts`.

For this first tracing step, we only instrument the model call. That means every time the agent calls OpenAI/Azure OpenAI, Langfuse will record the request, response, model name, token usage, and latency.

Add the import:

```ts
import { observeOpenAI } from "@langfuse/openai";
```

Then **wrap the OpenAI client where you create it**. Find this line in `runSupportConversation`:

```ts
const openai = createOpenAIClient();
```

and change it to:

```ts
const openai = observeOpenAI(createOpenAIClient());
```

That's the entire diff for tracing the model call. The provider-specific setup stays in `createOpenAIClient`, and `observeOpenAI` wraps whichever client it returns. This is why the same code still works whether your `.env` points to Azure OpenAI or the OpenAI Platform.

The important line is still the normal SDK call below it:

```ts
openai.chat.completions.create(...)
```

Because `openai` is now the observed client, that SDK call emits a Langfuse generation every time it runs.

At this point you are tracing only the model provider call. That is useful because you can inspect the exact messages sent to the model, the assistant response, token usage, latency, and model name. But the OpenAI calls still appear as separate top-level traces, so the trace list does not yet show that those calls all belonged to one user chat turn.

**Verify:** `npm run dev`, ask one question, refresh Langfuse — you should see one generation per OpenAI call with prompt, response, tokens, and latency. Each generation is still its own top-level trace; we fix that next.

![Langfuse Traces view after Step 1 — each chat turn appears as standalone openai-chat-completion generations.](../images/tracing/02-tracing-step-1.png)

## Step 2 — Wrap the full chat turn

After Step 1, Langfuse can see the individual OpenAI/Azure OpenAI calls. But each model call still looks like a separate trace. 
In Step 2, we wrap the whole `runSupportConversation(...)` function. This function is the main entry point for one chat turn: it receives the user's chat request, runs the agent logic, and returns the assistant response.

By wrapping this function with `observe(...)`, Langfuse gets one parent observation for the whole chat turn. The model calls from Step 1 are then grouped inside that same trace. The trace becomes easier to read:

- the parent observation is the full support-agent turn,
- the child observations are the model calls made during that turn.

The important idea is: we keep the agent logic unchanged, but export a Langfuse-wrapped version of it. The rest of the app still calls `runSupportConversation(...)` as before, but Langfuse can now record the full function call.

Three edits in `src/server/support-agent.ts` — no function body changes.

**1. Add the import:**

```ts
import { observe } from "@langfuse/tracing";
```

**2. Keep the existing implementation, but stop exporting it directly.**

Right now, `runSupportConversation(...)` is the function that contains the agent logic, and it is exported directly:

```ts
export async function runSupportConversation(request: ChatRequest): Promise<ChatResponse> {
```

We now split this into two functions:

- `runSupportConversationInner(...)` contains the existing agent logic,
- `runSupportConversation` becomes the exported Langfuse-wrapped version.

To do that, remove `export` and rename the function:

```ts
async function runSupportConversationInner(request: ChatRequest): Promise<ChatResponse> {
```

The function body stays exactly as it is. We are not changing the agent behavior. We only rename the function so we can wrap it before exporting it again.


**3. Add the wrapped export at the bottom of the file:**

```ts
export const runSupportConversation = observe(runSupportConversationInner, {
  name: "dad-it-support-chat-turn",
  asType: "agent"
});
```

`index.ts` still imports `runSupportConversation` the same way, so the rest of the app does not need to change.

When `index.ts` calls `runSupportConversation(request)`, it now calls the wrapped function. Langfuse then:

- records the `request` as the observation input,
- executes `runSupportConversationInner(request)`,
- records the returned `ChatResponse` as the observation output,
- records how long the function took,
- keeps the model/tool calls connected to the same trace.

This also avoids a TypeScript duplicate export problem. We cannot export both the original function and the wrapped function with the same name. There should be exactly one exported `runSupportConversation`, and it should be the Langfuse-wrapped one.

The call stack now looks like this:

```text
index.ts
  calls runSupportConversation(...)
    Langfuse starts dad-it-support-chat-turn
      runSupportConversationInner(...) runs the agent loop
        observeOpenAI(...) records each model call underneath
    Langfuse records the final ChatResponse as the parent output
```

**Verify:** one chat turn should now show up as a single `dad-it-support-chat-turn` observation with the OpenAI generation nested underneath.

![Trace tree after Step 2 — one dad-it-support-chat-turn agent root with the OpenAI generation as a child.](../images/tracing/02-tracing-step-2.png)



## Step 3 — Recording tool calls

The OpenAI generation already mentions the tool calls in its `tool_calls` output, but we have no observation for the actual tool execution — no way to see what input went in and what came out. The same `observe(...)` pattern, can be applied to each tool.

### `src/server/tools.ts`

Add the import and the two observed helpers above `executeTool`, then redirect the switch at them. `TOOL_DEFINITIONS` stays untouched.

Keep the difference between two pieces of code clear:

- `TOOL_DEFINITIONS` is only the schema sent to the model. It tells the model which tools exist and which arguments each tool accepts.
- `executeTool(...)` is the local dispatcher. It receives the tool name chosen by the model and runs the matching TypeScript function.

Before this step, Langfuse can see that the model requested a tool call because that request appears in the OpenAI generation output. But Langfuse cannot yet see the actual local work: what `getSupportContext()` returned, what question went into `searchGuides(...)`, or which guide results came back.

The fix is to move each local tool body into a small observed helper. Then `executeTool(...)` keeps the same public contract, but routes to those observed helpers instead of doing the work inline.

```ts
import { observe } from "@langfuse/tracing";

const getSupportContextTool = observe(
  async () => {
    const context = getSupportContext();

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

const searchHelpLibraryTool = observe(
  async (input: { question: string }) => {
    const guides = searchGuides(input.question);

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

export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_support_context":
      return getSupportContextTool();

    case "search_help_library":
      return searchHelpLibraryTool({ question: String(input.question ?? "") });

    default:
      return { ok: false, error: `Unsupported tool: ${name}` };
  }
}
```

After this change, the model's tool request and the local tool execution are both visible:

```text
dad-it-support-chat-turn
  openai-chat-completion     model asks to call get_support_context
  get_support_context        local tool runs and returns Dad's context
  openai-chat-completion     model asks to call search_help_library
  search_help_library        local tool runs and returns guide matches
  openai-chat-completion     model writes the final answer
```

![Full trace after Step 3 — dad-it-support-chat-turn (agent) with the OpenAI generation and get_support_context + search_help_library tool observations as siblings underneath.](../images/tracing/02-tracing-step-3.png)


## How to verify you are done

- A single user turn creates one trace in Langfuse.
- Root observation: `dad-it-support-chat-turn` (type `agent`).
- Child generation from `observeOpenAI(...)` with prompt, response, tokens, latency.
- Child tool observations: `get_support_context`, `search_help_library`.
- Root input is the chat request; root output is the chat response.

## Wrap-up

Same pattern, different observation types, same concept: `observe(fn, { asType })` wraps a function and emits a span with the name and type you give it. `observeOpenAI(client)` is a specialized version of that wrap for the OpenAI SDK.

`observeOpenAI` itself wraps the official OpenAI SDK — under the hood it's the same as the Langfuse [auto-instrumentation for OpenAI JS](https://langfuse.com/integrations/model-providers/openai-js). If you're using a different SDK (Anthropic, Vercel AI SDK, your own HTTP client), the Langfuse [integrations catalogue](https://langfuse.com/integrations) has the equivalent wrapper or auto-instrumentation guide.

## Appendix/Bonus section — User and session IDs

The walkthrough above gets you tracing with a clean parent → generation → tool shape. The next thing most teams want is to **slice traces by user and by session** — so you can pull up "every turn this user has had with the agent" or "the full multi-turn session from yesterday morning."
For simplicity reasons we skip this step in the live tracing walkthrough, but the checkpoints after tracing include it so later chapters can use session/user views without another code step. See information on [Sessions](https://langfuse.com/docs/observability/features/sessions) and [Users](https://langfuse.com/docs/observability/features/users) in the Langfuse docs.

In short:

```ts
import { propagateAttributes } from "@langfuse/tracing";

return propagateAttributes(
  {
    userId: request.userId ?? `workshop-${context.id}`,
    sessionId: request.sessionId,
    tags: ["langfuse-workshop", "dad-it-support"]
  },
  async () => {
    // ...the same tool-calling loop...
  }
);
```

Anything inside the `propagateAttributes(...)` block — including all child spans emitted by `observeOpenAI` — automatically gets the `userId`, `sessionId`, and tags attached. The Langfuse **Users** view, **Sessions** view, and tag filters all light up as soon as the attributes are present.


## End state

This finished traced app is the starting point for `03-prompt-management` and `04-monitoring`.
