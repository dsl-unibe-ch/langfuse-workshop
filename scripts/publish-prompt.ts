import "../src/server/load-env";
import { LangfuseClient } from "@langfuse/client";
import { env } from "../src/server/env";
import { SYSTEM_PROMPT } from "../src/server/support-agent";

// Keep workshop prompt variants in code so changes can be reviewed and republished.
// The default variant is exactly the fallback prompt used by the application.
const PROMPT_VARIANTS = {
  default: SYSTEM_PROMPT,
  gentler: `${SYSTEM_PROMPT.trim()}

Tone variant:
- Be extra patient and reassuring when Dad seems uncertain.
- Use plain, familiar wording before technical terms.
- Start in-scope final answers with one brief confidence-building sentence.
- If the request is out of scope, say so directly but warmly, then offer the closest iPhone-help next step.
`
} as const;

type WorkshopPromptVariant = keyof typeof PROMPT_VARIANTS;

function resolvePromptVariant(variantName: string): {
  name: WorkshopPromptVariant;
  prompt: string;
} {
  // Convert WORKSHOP_PROMPT_VARIANT into one known prompt definition.
  const normalizedVariantName = variantName.trim() || "default";

  if (normalizedVariantName in PROMPT_VARIANTS) {
    // The key check above makes this type conversion safe.
    const name = normalizedVariantName as WorkshopPromptVariant;
    return { name, prompt: PROMPT_VARIANTS[name] };
  }

  throw new Error(
    `Unsupported WORKSHOP_PROMPT_VARIANT "${variantName}". ` +
      `Supported variants: ${Object.keys(PROMPT_VARIANTS).join(", ")}.`
  );
}

async function main() {
  // Publish the selected prompt text under the configured Langfuse name and label.
  const variant = resolvePromptVariant(env.workshopPromptVariant);

  if (!env.langfusePublicKey || !env.langfuseSecretKey) {
    throw new Error("Langfuse credentials are required to publish prompts.");
  }

  // Use the same Langfuse project configuration as the server and dataset scripts.
  const langfuse = new LangfuseClient({
    publicKey: env.langfusePublicKey,
    secretKey: env.langfuseSecretKey,
    baseUrl: env.langfuseBaseUrl
  });

  const name = env.langfusePromptName || "dad-it-support-agent";
  const label = env.langfusePromptLabel || "production";

  // Creating a new version under the same name preserves prompt history in Langfuse.
  await langfuse.prompt.create({
    name,
    type: "text",
    prompt: variant.prompt,
    labels: [label]
  });

  console.log(`Published prompt "${name}" (${variant.name} variant) with label "${label}".`);
}

// Start the command-line script without introducing top-level await.
void main();
