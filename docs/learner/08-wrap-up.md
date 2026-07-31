---
title: "Workshop: Wrap-up"
description: "Review the complete AI engineering loop and how to apply tracing, monitoring, datasets, experiments, and evaluation to your own LLM app."
---

# 08 Wrap-up

## Starting point

```bash
git checkout checkpoint/08-wrap-up
```

You have walked through every loop step.

## What you should be able to do now

- Trace an LLM app end-to-end and read the result as a debugging surface (**02 Tracing**).
- Connect prompts to traces so a prompt change has a measurable next-trace effect (**03 Prompt Management**).
- Detect interesting production behavior, such as out-of-scope requests or user disagreement, automatically (**04 Monitoring**).
- Create a reference dataset with realistic user questions, expected answers, and metadata (**05 Dataset**).
- Run the agent code against every dataset item and score the results (**06 Experiments**).
- Compare runs after changes and decide which setup is better — by score and by reading individual outputs (**07 Evaluate a Change**).


## Bigger picture

Langfuse in this workshop is a *shared surface*, not just observability:

- understanding behavior — every interaction is inspectable
- collecting representative examples — production seeds datasets
- comparing changes — every prompt or code change has a baseline
- improving systems continuously — the loop closes back on itself

## Good closing questions

- What did tracing reveal that was invisible before?
- Which production events would you monitor first in your own app?
- What would you add to the starter dataset next?
- What change would you test after the first prompt iteration?
- Where in your real app would the `/langfuse` skill have saved you the most hand-rolling?

## How to work on your own application

When you go back to your own codebase, the goal is to connect *that* application to a Langfuse project in the same way this workshop app is connected.

The mental model is:

```text
your app/codebase
  -> sends traces, prompts, datasets, experiment runs, and scores
  -> Langfuse Cloud UI
```

Langfuse has three surfaces you will use together:

- **Langfuse UI** — where you inspect traces, manage prompts, review datasets, and compare runs.
- **Langfuse SDKs** — what your app uses in code to send traces, scores, prompts, and experiment data.
- **Langfuse CLI** — a command-line interface for the same Langfuse project. It lets you interact with Langfuse from the terminal instead of clicking through the UI.

They all point at the same Langfuse project through the same project API keys. 

Do this in order:

1. **Create or choose a Langfuse project** for your own app. Copy that project's API keys into your application's local `.env`:

   ```dotenv
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_BASE_URL=https://cloud.langfuse.com
   ```

2. **Check that the [Langfuse CLI](https://langfuse.com/docs/api-and-data-platform/features/cli) can reach that project.** The CLI is not required for tracing, but it is useful when you want Langfuse actions to be repeatable or automated.

   Think of it as the terminal version of the UI. In the UI, you click through traces, prompts, datasets, and runs. With the CLI, you can ask for the same kinds of resources from a shell command. That makes it useful for scripts, CI/CD, coding agents, and repeatable analysis — for example, listing recent traces, checking whether a dataset exists, or inspecting scores without doing the same clicks by hand each time.

   Run it from a shell that has loaded your `.env`:

   ```bash
   npx langfuse-cli api __schema
   ```

   If you prefer a global binary, install the published `langfuse-cli` package:

   ```bash
   npm install -g langfuse-cli
   langfuse api __schema
   ```

3. **Install the [Langfuse skill](https://github.com/langfuse/skills)** (`/langfuse`) — it packages the recommended tracing, prompt management, monitoring, and evaluator patterns from this workshop and applies them to your codebase without you hand-rolling each piece:

   ```bash
   npx skills add langfuse/skills --skill "langfuse"
   ```

4. **Pick the smallest LLM-using surface** you have and wire `observe(...)` + `observeOpenAI(...)` first. Get one trace before you do anything else.

5. **Add user/session information** only once you have at least two users or two sessions of traffic — there's no point until then.

6. **Build your first dataset *from real traces, discussions with experts, or past examples*** rather than from imagination. Production behavior will tell you over time what your dataset needs to cover.

7. **Run one experiment, change one thing, rerun.** Then repeat.

For the bigger-picture material on each step, the [Langfuse Academy](https://langfuse.com/academy) has dedicated lessons:

- [The AI Engineering Loop](https://langfuse.com/academy/ai-engineering-loop)
- [Tracing](https://langfuse.com/academy/tracing)
- [Monitoring](https://langfuse.com/academy/monitoring)
- [Datasets](https://langfuse.com/academy/datasets)
- [Experiments](https://langfuse.com/academy/experiments)
- [Evaluate](https://langfuse.com/academy/evaluate)
