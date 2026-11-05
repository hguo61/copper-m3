// @vitest-environment node
import { MockEmbeddingModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiNotConfiguredError, callEmbed } from "@/lib/ai/call";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { PRICING } from "@/lib/ai/pricing";

// Google hands back a mock embedding model that returns a fixed vector per value.
let model: MockEmbeddingModelV4;
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => ({ textEmbedding: () => model }),
}));

function embedWith(dimensions: number, tokens = 40) {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: 100,
    doEmbed: async ({ values }) => ({
      embeddings: values.map((_, i) =>
        Array.from({ length: dimensions }, (__, d) => (i + 1) / (d + 1)),
      ),
      usage: { tokens },
      warnings: [],
    }),
  });
}

function captureLog() {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  return () =>
    info.mock.calls
      .filter(([tag]) => tag === "[ai_calls]")
      .map(([, row]) => JSON.parse(row as string));
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("callEmbed", () => {
  it("returns one vector per value, in order", async () => {
    model = embedWith(EMBEDDING_MODEL.dimensions);
    const vectors = await callEmbed(
      { module: 3, feature: "test" },
      { values: ["a", "b", "c"], taskType: "RETRIEVAL_DOCUMENT" },
    );
    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(EMBEDDING_MODEL.dimensions);
    expect(vectors[1][0]).toBe(2);
  });

  it("asks Google for the configured dimensions and task type", async () => {
    model = embedWith(EMBEDDING_MODEL.dimensions);
    await callEmbed(
      { module: 3, feature: "test" },
      { values: ["question"], taskType: "RETRIEVAL_QUERY" },
    );
    expect(model.doEmbedCalls[0].providerOptions).toEqual({
      google: {
        outputDimensionality: EMBEDDING_MODEL.dimensions,
        taskType: "RETRIEVAL_QUERY",
      },
    });
  });

  it("logs one ai_calls row with the tokens read and the embedding price", async () => {
    model = embedWith(EMBEDDING_MODEL.dimensions, 1_000_000);
    const rows = captureLog();
    await callEmbed(
      { module: 3, feature: "ingest-docs" },
      { values: ["a", "b"], taskType: "RETRIEVAL_DOCUMENT" },
    );
    expect(rows()).toEqual([
      expect.objectContaining({
        module: 3,
        feature: "ingest-docs",
        model: EMBEDDING_MODEL.id,
        input_tokens: 1_000_000,
        output_tokens: 0,
        cost_usd: PRICING[EMBEDDING_MODEL.id].input,
        ok: true,
      }),
    ]);
  });

  it("throws AiNotConfiguredError without a key, and logs nothing", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const rows = captureLog();
    await expect(
      callEmbed(
        { module: 3, feature: "test" },
        { values: ["a"], taskType: "RETRIEVAL_DOCUMENT" },
      ),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(rows()).toEqual([]);
  });
});
