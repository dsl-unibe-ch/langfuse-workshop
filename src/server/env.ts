import "./load-env";

// Select which OpenAI-compatible backend the app should call.
const openaiProvider =
  process.env.OPENAI_PROVIDER === "openai" || process.env.OPENAI_PROVIDER === "gpustack"
    ? process.env.OPENAI_PROVIDER
    : "azure";
const azureOpenAIDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "";
const gpuStackModel = process.env.GPUSTACK_MODEL ?? "gpt-oss-120b";

// Read environment variables once so the rest of the app uses one typed configuration object.
export const env = {
  port: Number(process.env.PORT ?? 8787),
  openaiProvider,
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.5-2026-04-23",
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  azureOpenAIDeployment,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview",
  gpuStackApiKey: process.env.GPUSTACK_API_KEY ?? "",
  gpuStackBaseUrl: process.env.GPUSTACK_BASE_URL ?? "https://gpustack.unibe.ch/v1",
  gpuStackModel,
  // Azure uses its deployment name; GPUStack and OpenAI use their configured model names.
  chatModel:
    openaiProvider === "azure" && azureOpenAIDeployment
      ? azureOpenAIDeployment
      : openaiProvider === "gpustack"
        ? gpuStackModel
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
  // Both project keys are required before traces can be sent to Langfuse.
  return Boolean(env.langfusePublicKey && env.langfuseSecretKey);
}
