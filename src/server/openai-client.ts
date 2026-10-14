import OpenAI, { AzureOpenAI } from "openai";
import { env } from "./env";

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
      throw new Error(`Missing Azure OpenAI configuration: ${missing.join(", ")}`);
    }

    return new AzureOpenAI({
      apiKey: env.azureOpenAIApiKey,
      endpoint: env.azureOpenAIEndpoint,
      deployment: env.azureOpenAIDeployment,
      apiVersion: env.azureOpenAIApiVersion
    });
  }

  if (env.openaiProvider === "gpustack") {
    if (!env.gpuStackApiKey) {
      throw new Error("Missing GPUStack configuration: GPUSTACK_API_KEY");
    }

    // GPUStack exposes an OpenAI-compatible API at a different base URL.
    return new OpenAI({
      apiKey: env.gpuStackApiKey,
      baseURL: env.gpuStackBaseUrl
    });
  }

  // Standard OpenAI only needs the platform API key.
  return new OpenAI({ apiKey: env.openaiApiKey });
}
