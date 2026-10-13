---
title: "Workshop: Instructor Notes for the Base App Tour"
description: "Facilitator notes for the base app chapter, including what to point out in the chat UI, Express route, agent loop, and local tools."
---

# 01 Base App

Learner guide: [01 Base App](../learner/01-base-app.md)

## Instructor notes

- This is a quick orientation chapter. There is intentionally nothing to build.
- Point at the three boundaries learners will instrument later: Express route, agent loop, local tools.
- Stress that the base app uses an OpenAI-compatible SDK client and local tool functions only. In this adapted workshop, the same code path can call Azure OpenAI or OpenAI Platform depending on `.env`.
- Make the model/tool boundary concrete: the model chooses a tool call, but `src/server/tools.ts` is where local TypeScript code actually executes it.

## Watch for

- Learners changing the prompt or tools here. Save all edits for `02-tracing`.
- Confusion between the full reference app on `main` and the untraced base checkpoint.
