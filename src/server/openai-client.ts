import OpenAI, { AzureOpenAI } from "openai";
import { env } from "./env";

async function gpuStackFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  // GPUStack currently labels non-streaming responses as JSON but prefixes the
  // body with "data: ". Remove that SSE prefix before the OpenAI SDK parses it.
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  const body = await response.text();
  const normalizedBody = body.startsWith("data: ") ? body.slice(6) : body;
  return new Response(normalizedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// Build the SDK client for the provider selected with OPENAI_PROVIDER.
export function createOpenAIClient(): OpenAI {
  if (env.openaiProvider === "azure") {
    // Azure needs its endpoint, deployment, API version, and API key.
    const missing = [
      ["AZURE_OPENAI_API_KEY", env.azureOpenAIApiKey],
      ["AZURE_OPENAI_ENDPOINT", env.azureOpenAIEndpoint],
      ["AZURE_OPENAI_DEPLOYMENT", env.azureOpenAIDeployment],
      ["AZURE_OPENAI_API_VERSION", env.azureOpenAIApiVersion]
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      // List every missing value at once so workshop setup is easier to fix.
      throw new Error(`Missing Azure OpenAI configuration: ${missing.join(", ")}`);
    }

    // Azure uses its dedicated SDK client and deployment-based model routing.
    return new AzureOpenAI({
      apiKey: env.azureOpenAIApiKey,
      endpoint: env.azureOpenAIEndpoint,
      deployment: env.azureOpenAIDeployment,
      apiVersion: env.azureOpenAIApiVersion
    });
  }

  if (env.openaiProvider === "gpustack") {
    // The OpenAI-compatible GPUStack endpoint still requires its own API key.
    if (!env.gpuStackApiKey) {
      throw new Error("Missing GPUStack configuration: GPUSTACK_API_KEY");
    }

    // GPUStack exposes an OpenAI-compatible API at a different base URL.
    return new OpenAI({
      apiKey: env.gpuStackApiKey,
      baseURL: env.gpuStackBaseUrl,
      fetch: gpuStackFetch
    });
  }

  // Standard OpenAI only needs the platform API key.
  return new OpenAI({ apiKey: env.openaiApiKey });
}
