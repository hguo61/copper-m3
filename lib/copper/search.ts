// Module 3: finds the passages of the customer documents that best match a
// question. The question is embedded with the same model as the passages
// (lib/copper/data/passages.json), then every passage is scored by cosine
// similarity, which is how close two vectors point. The top few come back with
// their document title, page and a link that opens the PDF on that page.
import { callEmbed } from "@/lib/ai/call";
import { DOCUMENTS } from "@/lib/copper/documents";
import { getPassages, type Passage } from "@/lib/copper/passages";

export type DocMatch = {
  /** The passage's id, unique across every document. */
  id: string;
  /** The document's title, e.g. "Copper Home User Guide". */
  title: string;
  /** 1-based page in the PDF. */
  page: number;
  /** The passage, without the title that the saved text starts with. */
  text: string;
  /** Opens the PDF on that page, e.g. "/docs/copper-home-user-guide.pdf#page=4". */
  url: string;
  /** Cosine similarity to the question, 0 to 1 (higher is closer). */
  score: number;
  documentId: string;
};

export type DocSearch = { question: string; matches: DocMatch[] };

/** How many passages search_docs returns. */
export const SEARCH_LIMIT = 5;

/** Cosine similarity: 1 when two vectors point the same way, 0 when unrelated. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

/** The PDF link for a passage: the document's file plus the page to open. */
export function passageUrl(passage: Pick<Passage, "documentId" | "page">) {
  const doc = DOCUMENTS.find((d) => d.id === passage.documentId);
  return `${doc?.file ?? `/docs/${passage.documentId}.pdf`}#page=${passage.page}`;
}

/** Scores every passage against a question vector and keeps the closest. */
export function rankPassages(
  question: number[],
  passages: Passage[],
  limit = SEARCH_LIMIT,
): DocMatch[] {
  return passages
    .map((p) => ({
      passage: p,
      score: cosineSimilarity(question, p.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ passage, score }) => ({
      id: passage.id,
      title: passage.title,
      page: passage.page,
      text: passage.text.startsWith(`${passage.title}: `)
        ? passage.text.slice(passage.title.length + 2)
        : passage.text,
      url: passageUrl(passage),
      score: Math.round(score * 1000) / 1000,
      documentId: passage.documentId,
    }));
}

/** search_docs: embeds the question and returns the closest passages. */
export async function searchDocs(
  question: string,
  limit = SEARCH_LIMIT,
): Promise<DocSearch> {
  const [vector] = await callEmbed(
    { module: 3, feature: "search-docs" },
    { values: [question], taskType: "RETRIEVAL_QUERY" },
  );
  return { question, matches: rankPassages(vector, getPassages(), limit) };
}
