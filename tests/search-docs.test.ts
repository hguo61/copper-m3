// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCUMENTS } from "@/lib/copper/documents";
import { getPassages } from "@/lib/copper/passages";
import {
  cosineSimilarity,
  passageUrl,
  rankPassages,
  SEARCH_LIMIT,
  searchDocs,
} from "@/lib/copper/search";

// The question's vector is whatever the test sets; no key or network needed.
let questionVector: number[] = [];
vi.mock("@/lib/ai/call", () => ({
  callEmbed: vi.fn(async () => [questionVector]),
}));

afterEach(() => vi.clearAllMocks());

describe("cosineSimilarity", () => {
  it("is 1 for the same direction, 0 for unrelated, and ignores length", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("rankPassages", () => {
  const passages = getPassages();

  it("puts the passage whose vector matches the question first and keeps 5", () => {
    const target = passages[17];
    const matches = rankPassages(target.embedding, passages);
    expect(matches).toHaveLength(SEARCH_LIMIT);
    expect(matches[0]).toMatchObject({
      id: target.id,
      title: target.title,
      page: target.page,
      documentId: target.documentId,
      score: 1,
    });
    for (let i = 1; i < matches.length; i++)
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
  });

  it("returns the passage text without the title in front", () => {
    const target = passages[0];
    const [best] = rankPassages(target.embedding, passages, 1);
    expect(best.text.startsWith(`${target.title}: `)).toBe(false);
    expect(target.text).toBe(`${target.title}: ${best.text}`);
  });

  it("links each match to its PDF at that page", () => {
    const target = passages[40];
    const [best] = rankPassages(target.embedding, passages, 1);
    const doc = DOCUMENTS.find((d) => d.id === target.documentId)!;
    expect(best.url).toBe(`${doc.file}#page=${target.page}`);
    expect(passageUrl({ documentId: "unknown-doc", page: 2 })).toBe(
      "/docs/unknown-doc.pdf#page=2",
    );
  });
});

describe("searchDocs", () => {
  it("embeds the question as a query and returns the closest passages", async () => {
    const { callEmbed } = await import("@/lib/ai/call");
    const target = getPassages()[5];
    questionVector = target.embedding;
    const result = await searchDocs("How do I set it up?");
    expect(callEmbed).toHaveBeenCalledWith(
      { module: 3, feature: "search-docs" },
      { values: ["How do I set it up?"], taskType: "RETRIEVAL_QUERY" },
    );
    expect(result.question).toBe("How do I set it up?");
    expect(result.matches).toHaveLength(5);
    expect(result.matches[0].title).toBe(target.title);
    expect(result.matches[0].page).toBe(target.page);
  });
});

describe("search_docs tool", () => {
  it("is one of Copper's tools, labelled for the panel, and named in the instructions", async () => {
    const { copperTools } = await import("@/lib/copper/assistant/tools");
    const { TOOL_LABELS } = await import("@/lib/copper/assistant/progress");
    const { COPPER_INSTRUCTIONS } =
      await import("@/lib/copper/assistant/instructions");
    expect(copperTools.search_docs.description).toMatch(/page/);
    expect(TOOL_LABELS.search_docs).toBeDefined();
    expect(COPPER_INSTRUCTIONS).toMatch(/search_docs/);
    for (const topic of ["setup", "troubleshooting", "warranty", "privacy"])
      expect(COPPER_INSTRUCTIONS.toLowerCase()).toContain(topic);
    expect(COPPER_INSTRUCTIONS).not.toMatch(/can't help with that yet/);
  });
});
