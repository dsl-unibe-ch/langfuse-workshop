---
title: "Workshop: Evaluate a Prompt Change"
description: "Change one prompt rule, rerun the same dataset, and compare Langfuse experiment scores to decide whether the update improved the agent."
---

# 07 Evaluate a change

## Starting point

```bash
git checkout checkpoint/07-evaluation
```

Your app is traced, monitored, has a hosted dataset, and at least one experiment run with both `keyword_overlap` and `correctness` scores. Now you make a change to the app and rerun the experiment to see whether it helped or hurt.

Look at your first experiment run before making changes. Open the dataset → **Runs** tab and check the averages:

- `correctness` average — what fraction of items did the judge mark as actually correct?
- `keyword_overlap` average — what fraction covered the expected steps?

Open the items where either score is low and read the agent's answer. A typical finding at this stage: the agent skips a step, refuses something it shouldn't, or gives generic advice instead of the iPhone-specific instructions. Whatever you see is the *problem you're about to try to fix*.

## Why evaluate changes with experiments

If you change anything about your AI app — a prompt, a model, the context you pass, even the agent architecture — you want to know whether the change actually made the system better. Eyeballing one or two outputs feels good but doesn't generalize. Rerunning the same dataset against the new version and comparing scores against the old run is the closest thing to a measurement.

This is also what lets you close the loop and **ship with confidence**: when the new run's averages go up (and you read enough individual items to be sure the score reflects reality), you have evidence to deploy the change.

## What you could change

This chapter is framed around prompt iteration because changing the prompt is the lowest-friction lever. The same workflow applies if you change:

- **The model** — change which model powers the agent, then rerun. For example, try a stronger model to improve correctness, or a cheaper/faster deployment to reduce cost and latency. The experiment tells you whether the tradeoff is worth it.
- **The context** — change the runtime information the model receives in addition to the prompt. In this app, that mostly means the data returned by tools such as `get_support_context` or `search_help_library`: Dad's iOS version, installed apps, device details, or guide results. The prompt tells the model how to behave; context gives it the facts to reason with.
- **The agent architecture** — change how the agent workflow is organized. For example, add a new tool, change when tools are called, require `get_support_context` before answering, or add retries for invalid tool arguments. This is deeper than prompt editing because it changes the steps the agent can take.
- **The prompt** — change the instructions the model follows. This is what we'll do here because it is the lowest-friction lever: one rule changes, then we rerun the same dataset to see whether behavior improved.

The shape is always the same: change *one* thing (or a configuration of multiple variables), rerun the dataset, compare runs side by side.

## Goal

Change something in the prompt and improve the experiment results — measured by `correctness` and `keyword_overlap` going up across the dataset.


Three passes:

1. **Change one thing** — edit the prompt in code and publish it, or edit it directly in Langfuse.
2. **Rerun the dataset** against the new prompt.
3. **Compare runs** side by side and decide whether to ship.

## Step 1 — Change the prompt

The change you make should be informed by what you saw in run 1 — for example, items where `correctness` was low because the agent danced around an out-of-scope question instead of refusing it cleanly. A concrete edit that addresses that:

> Add a rule that says: *"If a request is outside iPhone help (taxes, travel booking, anything that needs live account access), say so directly in one short sentence — what you can't help with and what you can — then stop. Do not attempt to answer the request."*

That makes the out-of-scope behaviour explicit instead of letting the model improvise.

Two ways to make the change:

**Option A — Code-side (recommended for this workshop):**

Open `src/server/support-agent.ts`, add the rule into the `SYSTEM_PROMPT` constant's Rules block, then publish:

```bash
npm run prompt:publish
```

This keeps the workshop repository and Langfuse aligned: the prompt change is visible in Git, and the same prompt is published into Langfuse as a new version. 

The repo also ships a `gentler` variant you can switch to as-is:

```bash
WORKSHOP_PROMPT_VARIANT=gentler npm run prompt:publish
```

That is useful if you just want to see *any* prompt change rather than design your own.

![Review Prompt Changes in Langfuse — side-by-side diff between v1 and the draft with the new out-of-scope rule highlighted, ready to save as a new version and promote to production.](../images/evaluate-a-change/07-evaluate-a-change-prompt-diff.png)

**Option B — Langfuse-side (edit in the UI):**

Prompts → `dad-it-support-agent` → edit body → add the rule above into the **Rules** section → save as a new version → promote the new version to the `production` label. The resolver fetches by label, so the next request picks up the new version automatically.

This is a good operational workflow when your team wants to iterate prompts in Langfuse without changing code. The tradeoff is that `src/server/support-agent.ts` does not change when you edit the prompt in the UI, so the repository and the active Langfuse prompt can differ. Which option is better depends on your team's needs: code-side changes are easier to version with the app, while UI-side changes are faster for prompt iteration and review inside Langfuse.

Either way you end up with a new prompt version, and the next `runSupportConversation(...)` call uses it.

## Step 2 — Rerun the dataset

```bash
npm run dataset:run
```

You now have two runs under the same dataset, each linked to a different prompt version. The same `keyword_overlap` script evaluator and `correctness` evaluator from step 06 score the new run automatically.

## Step 3 — Compare

In Langfuse:

- Dataset → **Runs** tab → both rows visible with `keyword_overlap` and `correctness` averages.
- **Chart view** → per-run averages side by side.
- Add the new run as 'Compare with' in the sidebar

![Side-by-side comparison](../images/evaluate-a-change/side-by-side-runs.png)

Things to look for:

- Which items improved (intentional).
- Which items regressed (the part that makes evaluation feel useful).
- Whether the prompt change shifted scope (more refusals? more confident answers? more steps per response?).

## How to verify you are done

- Two runs appear under the dataset, linked to different prompt versions.
- Both scores (`keyword_overlap`, `correctness`) have averages you can compare.
- If a score is missing, check whether `npm run dataset:run` finished successfully; in the main workshop path both scores are returned by the script.

## Wrap-up

Closing the loop — change → rerun → compare → decide — is what makes prompt or model changes go from gut calls to engineering decisions. Every future change has a free baseline to measure against.

The [**Langfuse skill**](https://github.com/langfuse/skills) (`/langfuse`) bumps prompt versions, links runs to versions, and produces a comparison chart automatically — this walkthrough exists so you see what the skill is doing under the hood.

## End state

This is the starting point for `08-wrap-up`.
