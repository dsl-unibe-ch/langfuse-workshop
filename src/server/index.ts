import "./load-env";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ChatRequest } from "../shared/types";
import { runSupportConversation } from "./support-agent";
import { env, isLangfuseConfigured } from "./env";
import { DEFAULT_SUPPORT_CONTEXT } from "./support-data";

// Start OpenTelemetry before handling requests so Langfuse can receive spans.
const langfuseSpanProcessor = new LangfuseSpanProcessor();
const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();

// Validate chat requests before passing them into the agent.
// Zod rejects malformed requests before they can reach the model or tools.
const requestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.union([z.literal("user"), z.literal("assistant")]),
        content: z.string().min(1),
        timestamp: z.string()
      })
    )
    .min(1)
});

const app = express();

// Parse JSON request bodies while preventing unexpectedly large payloads.
app.use(express.json({ limit: "1mb" }));

// Lightweight status endpoint for setup checks and provider debugging.
app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    provider: env.openaiProvider,
    tracingConfigured: isLangfuseConfigured()
  });
});

// Expose the fixed Dad/iPhone context used by the local tools.
app.get("/api/support-context", (_request, response) => {
  response.json(DEFAULT_SUPPORT_CONTEXT);
});

// Main chat endpoint: validate input, run the agent, and return its answer.
app.post("/api/chat", async (request, response) => {
  try {
    // Convert unknown request data into the ChatRequest shape used by the agent.
    const payload = requestSchema.parse(request.body) as ChatRequest;
    const result = await runSupportConversation(payload);
    response.json(result);
  } catch (error) {
    // Return validation and provider errors to the browser as readable messages.
    const message = error instanceof Error ? error.message : "Unknown server error";
    response.status(400).send(message);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Resolve dist relative to this file in both development and compiled builds.
const clientDist = path.resolve(currentDir, "../../dist");

// In production, serve the built Vite app from dist.
app.use(express.static(clientDist));
app.use((_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(env.port, "127.0.0.1", () => {
  console.log(`Dad IT Support Agent server listening on http://127.0.0.1:${env.port}`);
});

// Flush Langfuse spans before the process exits so local traces are not lost.
async function shutdown() {
  // Finish active HTTP requests before flushing telemetry.
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  // Langfuse sends traces in the background, so wait for them before exiting.
  await langfuseSpanProcessor.forceFlush();
  await sdk.shutdown();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
