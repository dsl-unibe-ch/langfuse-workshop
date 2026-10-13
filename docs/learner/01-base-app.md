---
title: "Workshop: Dad IT Support Agent Base App"
description: "Tour the TypeScript support agent before instrumentation: chat UI, Express API, OpenAI-compatible tool loop, local tools, and support data."
---

# 01 Base App

> You already cloned the repo and checked out the workshop app in `00-setup`. The base app is in that same checkout, so there is nothing to build in this chapter — just orient yourself before tracing starts in `02-tracing`.

## What the running app does

- Dad himself is the user. Specs (the agent) talks directly to him about his iPhone.
- One OpenAI-compatible tool-calling loop. Depending on your `.env`, the model call can go to Azure OpenAI or OpenAI Platform, but the agent code uses the same chat-completions shape either way.
- Two local tools help the model answer with app-specific information:
  - `get_support_context` returns Dad's known device setup, such as phone model, relevant apps, and response preferences.
  - `search_help_library` looks up predefined device help instructions from `src/server/support-data.ts` (that file contains help content for topics like Bluetooth, Wi-Fi, WhatsApp/photo sharing, Maps, Messages, etc.).
- The system prompt is rendered locally from `src/server/support-agent.ts`. No Langfuse yet.

The model does not run these tools itself. It only asks for a tool to be called. The TypeScript code in `src/server/tools.ts` runs the tool and sends the result back to the model. In the tracing chapter, Langfuse will show both parts: the model's tool request and the tool's result.

![How Specs handles a ticket — one agent, two tools, one model, each hop an observation in the trace.](../images/specs_illustration.png)

## Where to look in the code

- `src/client/App.tsx` — chat UI + side panel
- `src/server/index.ts` — backend API routes that receive chat requests and return responses
- `src/server/support-agent.ts` — system prompt + tool-calling loop you'll instrument in `02-tracing`
- `src/server/tools.ts` — lists the available tools and contains the switch that decides which tool function to run
- `src/server/support-data.ts` — contains the example data: Dad's phone setup and the built-in iPhone help guides


## Bonus

You can customize the demo by changing the phone details in `src/server/support-data.ts`. If you add a real device setup, Specs will answer for that phone instead of the default iPhone 15 profile.

## End state

You are ready to start `02-tracing`.
