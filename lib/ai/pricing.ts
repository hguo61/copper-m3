import {
  EMBEDDING_MODEL,
  type EmbeddingModelId,
  type ModelId,
} from "@/lib/ai/models";

/** Every model with a price: the chat models plus the embedding model. */
export type PricedModelId = ModelId | EmbeddingModelId;

// US dollars per million tokens: Google's list prices as of 2026-10.
// Billing may differ slightly; these are for cost estimates.
export const PRICING: Record<PricedModelId, { input: number; output: number }> =
  {
    "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "google/gemini-3-flash": { input: 0.5, output: 3 },
    // Embeddings only read text, so they have no output price.
    [EMBEDDING_MODEL.id]: { input: 0.15, output: 0 },
  };

export function costUsd(
  model: PricedModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICING[model];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
