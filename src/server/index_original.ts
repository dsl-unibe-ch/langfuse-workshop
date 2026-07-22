import "./load-env";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ChatRequest } from "../shared/types";
import { runSupportConversation } from "./support-agent";
import { env } from "./env";
import { DEFAULT_SUPPORT_CONTEXT } from "./support-data";

// Validate chat requests before passing them into the agent.
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
app.use(express.json({ limit: "1mb" }));

// Lightweight status endpoint for setup checks.
app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    provider: "openai",
    tracingConfigured: false
  });
});

// Expose the fixed Dad/iPhone context used by the local tools.
app.get("/api/support-context", (_request, response) => {
  response.json(DEFAULT_SUPPORT_CONTEXT);
});

// Main chat endpoint: validate input, run the agent, and return its answer.
app.post("/api/chat", async (request, response) => {
  try {
    const payload = requestSchema.parse(request.body) as ChatRequest;
    const result = await runSupportConversation(payload);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    response.status(400).send(message);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, "../../dist");

// In production, serve the built Vite app from dist.
app.use(express.static(clientDist));
app.use((_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(env.port, "127.0.0.1", () => {
  console.log(`Dad IT Support Agent server listening on http://127.0.0.1:${env.port}`);
});

// Close the local HTTP server when the dev process is stopped.
async function shutdown() {
  server.close();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
