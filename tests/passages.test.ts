// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";
import {
  countPassagesByDocument,
  getPassageIndexInfo,
  getPassages,
} from "@/lib/copper/passages";
import {
  cleanPageText,
  splitIntoPassages,
  splitSentences,
} from "@/lib/copper/split-passages";

const PAGE = `Copper Home listens for its wake word.
It only sends audio to the cloud after you say "Hey Copper". The light turns
amber while it is listening. You can mute the microphone with the switch on the
back. Muting cuts power to the microphone circuit. Nothing is recorded while
muted! Is the switch red? Then the microphone is off. Copper Plus members get
twelve months of memory. The free plan keeps thirty days.`;

describe("splitSentences", () => {
  it("collapses line breaks and splits after . ! and ?", () => {
    const sentences = splitSentences(PAGE);
    expect(sentences[0]).toBe("Copper Home listens for its wake word.");
    expect(sentences).toContain("Nothing is recorded while muted!");
    expect(sentences).toContain("Is the switch red?");
    expect(sentences.at(-1)).toBe("The free plan keeps thirty days.");
    expect(sentences).toHaveLength(10);
  });

  it("rejoins a word hyphenated across lines", () => {
    expect(cleanPageText("the micro-\nphone is off")).toBe(
      "the microphone is off",
    );
  });
});

describe("splitIntoPassages", () => {
  it("makes passages of a few whole sentences and keeps every word", () => {
    const passages = splitIntoPassages(PAGE, {
      maxSentences: 4,
      minChars: 0,
    });
    expect(passages.length).toBeGreaterThan(1);
    for (const passage of passages) {
      expect(passage).toMatch(/[.!?]$/);
      expect(splitSentences(passage).length).toBeLessThanOrEqual(4);
    }
    expect(passages.join(" ")).toBe(cleanPageText(PAGE));
  });

  it("respects the character limit", () => {
    for (const passage of splitIntoPassages(PAGE, {
      maxChars: 120,
      minChars: 0,
    })) {
      expect(passage.length).toBeLessThanOrEqual(
        120 + "Copper Plus members get twelve months of memory.".length,
      );
    }
  });

  it("attaches a short tail to the passage before it", () => {
    const passages = splitIntoPassages(
      "First sentence here. Second one. Tiny.",
      {
        maxSentences: 2,
        minChars: 50,
      },
    );
    expect(passages).toEqual(["First sentence here. Second one. Tiny."]);
  });

  it("returns nothing for a blank page", () => {
    expect(splitIntoPassages("  \n ")).toEqual([]);
  });
});

describe("passages.json (made by npm run ingest)", () => {
  const passages = getPassages();

  it("was made by the embedding model with its dimensions", () => {
    const info = getPassageIndexInfo();
    expect(info.model).toBe(EMBEDDING_MODEL.id);
    expect(info.dimensions).toBe(EMBEDDING_MODEL.dimensions);
    expect(Date.parse(info.createdAt)).not.toBeNaN();
  });

  it("has passages from every document", () => {
    const counts = countPassagesByDocument(passages);
    for (const doc of DOCUMENTS) expect(counts[doc.id]).toBeGreaterThan(0);
    expect(Object.keys(counts).sort()).toEqual(
      DOCUMENTS.map((d) => d.id).sort(),
    );
  });

  it("keeps the title and page with each passage and starts the text with the title", () => {
    const titles = new Map(DOCUMENTS.map((d) => [d.id, d.title]));
    for (const p of passages) {
      expect(p.title).toBe(titles.get(p.documentId));
      expect(p.text.startsWith(`${p.title}: `)).toBe(true);
      expect(p.page).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(p.page)).toBe(true);
    }
  });

  it("gives every passage a unique id and a full-length vector", () => {
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
    for (const p of passages) {
      expect(p.embedding).toHaveLength(EMBEDDING_MODEL.dimensions);
      expect(p.embedding.every((x) => Number.isFinite(x))).toBe(true);
    }
  });
});
