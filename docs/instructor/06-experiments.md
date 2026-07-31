---
title: "Workshop: Instructor Notes for Experiments"
description: "Facilitator notes for running Langfuse experiments, combining deterministic and LLM-as-a-judge scores in the experiment script, and inspecting run results."
---

# 06 Experiments

Learner guide: [06 Experiments](../learner/06-experiments.md)

## Instructor notes

- The key idea is reuse: the experiment runner calls the same `runSupportConversation(...)` as the web app.
- Contrast deterministic scoring (`keyword_overlap`) with LLM-as-a-judge scoring (`correctness`). Both live in `scripts/run-dataset.ts` for the main workshop path.
- Emphasize the ownership difference: in the script-run path, the repo owns the judge prompt and calls the judge model; in the optional UI-managed path, Langfuse owns and runs the judge.
- Point out that `correctness` uses one extra model call per dataset item. Keep the dataset small for workshops so the cost and runtime stay predictable.
- Point out that the script wraps the judge client with `observeOpenAI(...)`, so the evaluator LLM call is observable too.
- Keep concurrency at one for workshops so traces and the final run summary are easy to follow.

## Demo rhythm

1. Skim the numbered sections in `scripts/run-dataset.ts`.
2. Point out the `keyword_overlap` evaluator inside the script.
3. Point out the `correctness` LLM-as-a-judge evaluator inside the script.
4. Run `npm run dataset:run`.
5. Open the run table, per-item traces, and chart view.
6. Optionally show how the same Correctness idea can be configured in the Langfuse UI as a platform-managed evaluator.

## Watch for

- If you demo the optional UI-managed Correctness evaluator, keep it on **Dataset runs** if you want the score to show up on the run rows and in run comparison.
- For the optional UI path, have learners switch from the default **Observations** view to **Dataset runs** before they configure anything else.
- For the optional UI path, Correctness evaluator mapping uses three different source dropdowns: `query` is **Input** with `$.messages[-1].content`, `generation` is **Output** with no JsonPath, and `ground_truth` is **Expected Output** with `$.idealAnswer`.
- A common UI misconfiguration is leaving all three variables on **Input**, which silently makes the evaluator read the wrong data for every field.
- Learners assuming the deterministic check must live in Langfuse now. It does not; mention the code-evaluator docs only as an alternative.
- Learners assuming the script-run judge needs a Langfuse LLM Connection. It does not; it uses the same Azure/OpenAI credentials as the app through `createOpenAIClient()`.
- "No default model set" only applies to the optional UI-managed evaluator; it is not needed for the main script-run path.
- If the script fails during `correctness`, inspect the judge model response and Azure/OpenAI model support for JSON responses.
