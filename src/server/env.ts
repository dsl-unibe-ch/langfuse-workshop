import "./load-env";

const openaiProvider = process.env.OPENAI_PROVIDER === "openai" ? "openai" : "azure";
const azureOpenAIDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "";

export const env = {
  port: Number(process.env.PORT ?? 8787),
  openaiProvider,
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.5-2026-04-23",
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  azureOpenAIDeployment,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview",
  chatModel:
    openaiProvider === "azure" && azureOpenAIDeployment
      ? azureOpenAIDeployment
      : (process.env.OPENAI_MODEL ?? "gpt-5.5-2026-04-23"),
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? "",
  langfuseBaseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
  langfusePromptName: process.env.LANGFUSE_PROMPT_NAME ?? "dad-it-support-agent",
  langfusePromptLabel: process.env.LANGFUSE_PROMPT_LABEL ?? "production",
  workshopPromptVariant: process.env.WORKSHOP_PROMPT_VARIANT ?? "default",
  datasetName: process.env.DATASET_NAME ?? "dad-it-support-workshop"
};

export function isLangfuseConfigured() {
  return Boolean(env.langfusePublicKey && env.langfuseSecretKey);
}
