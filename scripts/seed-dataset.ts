import "../src/server/load-env";
import { LangfuseClient } from "@langfuse/client";
import seedDataset from "../data/seed-dataset.json";
import { env } from "../src/server/env";

async function main() {
  // Fail early instead of attempting dataset writes without Langfuse credentials.
  if (!env.langfusePublicKey || !env.langfuseSecretKey) {
    throw new Error("Langfuse credentials are required to seed a dataset.");
  }

  const langfuse = new LangfuseClient({
    publicKey: env.langfusePublicKey,
    secretKey: env.langfuseSecretKey,
    baseUrl: env.langfuseBaseUrl
  });

  // Create the dataset once; an existing dataset is safe to reuse.
  try {
    await langfuse.api.datasets.create({
      name: env.datasetName,
      description: "Starter workshop dataset for the Dad IT Support Agent",
      metadata: {
        source: "repo-seed",
        workshop: "langfuse-dad-it-support"
      }
    });
  } catch (error) {
    if (!(error instanceof Error) || !/exists|duplicate/i.test(error.message)) {
      throw error;
    }
  }

  // Upload each local JSON example as one Langfuse dataset item.
  for (const item of seedDataset) {
    await langfuse.api.datasetItems.create({
      id: item.id,
      datasetName: env.datasetName,
      input: item.input,
      expectedOutput: item.expectedOutput,
      metadata: item.metadata
    });
  }

  // Wait for pending API operations before the script exits.
  await langfuse.flush();
  console.log(`Seeded dataset "${env.datasetName}" with ${seedDataset.length} items.`);
}

void main();
