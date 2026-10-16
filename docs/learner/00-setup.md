---
title: "Workshop: Setup"
description: "Set up the workshop app with GPUStack, Azure OpenAI, or OpenAI Platform credentials and Langfuse credentials, then verify the local Dad IT Support Agent."
---

# 00 Setup

## Goal

Have the workshop app running locally with model-provider and Langfuse credentials in place. From here you can skim `01-base-app`, then start building in `02-tracing`.

> ⚠️ Use **Langfuse Cloud** so you have the latest features this workshop describes. Self-hosted instances may be on an older version and will not match the lessons.

## Prerequisites

**Node.js `^20.19.0 || >=22.12.0`** — check with `node -v` and upgrade before installing if you are below it (`nvm install 22`, or the equivalent for `asdf`, `fnm`, or `volta`).

An older version fails in a way that is easy to misread. Vite's platform-specific binary is an optional dependency, so npm skips it **without reporting an error**: `npm install` looks like it succeeded, and the problem only appears later when `npm run dev` cannot start Vite. If you upgrade Node after installing, re-run `npm ci` so the skipped binary is fetched.

## Starting point

Clone the workshop repository, enter it, then check out the setup checkpoint for this chapter:

```bash
git clone https://github.com/langfuse/langfuse-workshop.git
cd langfuse-workshop
git checkout checkpoint/00-setup
```

This checkpoint intentionally contains the same untraced base app as `checkpoint/01-base-app`. Use it to confirm that your API keys, dependencies, and local ports work before switching to the build chapters. The Langfuse keys are configured now, but traces start only after you add instrumentation in `02-tracing`.

## How checkpoints work

Each checkpoint is the **starting point** for a lesson. If you finish a lesson manually, your code should roughly match the next checkpoint. If you get stuck or want to skip ahead, check out the next checkpoint and continue from there.

For the 90-minute live workshop, we focus on:

- `checkpoint/00-setup`
- `checkpoint/01-base-app`
- `checkpoint/02-tracing`
- `checkpoint/05-dataset`
- `checkpoint/06-experiments`
- `checkpoint/07-evaluation`

The complete self-guided workshop also includes:

- `checkpoint/03-prompt-management`
- `checkpoint/04-monitoring`
- `checkpoint/08-wrap-up`

To move to a checkpoint, run:

```bash
git checkout checkpoint/02-tracing
```

Replace `02-tracing` with the lesson you want to start.

## Step 1 — Get the API keys

1. **Model provider** — GPUStack is the default for this workshop. Azure OpenAI and OpenAI Platform are also supported.
   - GPUStack: use the API key provided by the University of Bern or the workshop organizer. The workshop uses the OpenAI-compatible endpoint `https://gpustack.unibe.ch/v1` and model `gpt-oss-120b`.
   - OpenAI Platform: [platform.openai.com](https://platform.openai.com) → API Keys → create one. Copy the `sk-...` value.
   - Azure OpenAI: add Azure OpenAI API key, endpoint, deployment name, and API version.
2. **Langfuse** — sign up at [langfuse.com](https://langfuse.com) on the **EU region**, create a project, and copy the public + secret keys from **Settings → API Keys**.


## Step 2 — Configure `.env`

```bash
cp .env.example .env
```

GPUStack is the default for this workshop. It provides an OpenAI-compatible API, so the application can use the standard OpenAI client with a different base URL. Fill in:

```bash
OPENAI_PROVIDER=gpustack
GPUSTACK_API_KEY=...
GPUSTACK_BASE_URL=https://gpustack.unibe.ch/v1
GPUSTACK_MODEL=gpt-oss-120b
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

If you are using Azure OpenAI instead, fill in:

```bash
OPENAI_PROVIDER=azure
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-chat-deployment-name
AZURE_OPENAI_API_VERSION=2024-10-01-preview
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

If you are using OpenAI Platform instead, fill in:

```bash
OPENAI_PROVIDER=openai
OPENAI_API_KEY=sk-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Leave the rest of the defaults as they are.

The workshop app always loads this repository's `.env` file for the server and helper scripts. If you have `LANGFUSE_*`, `OPENAI_*`, or `DATASET_NAME` values exported in your shell from another project, they will not override this file. To change the workshop configuration, edit `.env`.

Keep these values in your local `.env` only. Do not paste real API keys into shared workshop notes, transcripts, screenshots, or chat messages.

## Step 3 — Install and run

```bash
npm install
npm run dev
```

Leave `npm run dev` running while you edit. Client changes hot-reload via Vite; server code and `.env` changes restart the API automatically. You do not need to stop and start the app for normal workshop edits.

Open [http://127.0.0.1:3333](http://127.0.0.1:3333) to access the Dad IT Support Agent UI.

If you want to verify the server separately, check [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health) or [http://127.0.0.1:8787/api/support-context](http://127.0.0.1:8787/api/support-context). During `npm run dev`, `127.0.0.1:8787/` is not the main app URL.

## Step 4 — Confirm what you see

You should see the **Dad IT Support Agent** chat:

- the Specs mascot up top
- a greeting from Specs
- suggestion chips below the greeting
- the iPhone panel on the right ("Dad" + iPhone 15 details)

![How Specs handles a ticket — one agent, two tools, one model, each hop an observation in the trace.](../images/specs_illustration.png)


## How to verify you are done

- `npm run dev` is running and listening on `http://127.0.0.1:3333` (client) and `http://127.0.0.1:8787` (API server).
- `http://127.0.0.1:8787/api/health` or `http://127.0.0.1:8787/api/support-context` returns a real response.
- The browser shows the Specs greeting, not an error.
- Sending one of the suggestion chips returns a real iPhone answer from the model.

## End state

Your environment is ready. To build the workshop step-by-step, skim `01-base-app` if you want the app tour, then check out `checkpoint/02-tracing` for the first code changes.
