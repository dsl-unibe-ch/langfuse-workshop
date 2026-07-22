import OpenAI, { AzureOpenAI } from "openai";
import { env } from "./env";

export function createOpenAIClient(): OpenAI {
  if (env.openaiProvider === "azure") {
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

  return new OpenAI({ apiKey: env.openaiApiKey });
}
