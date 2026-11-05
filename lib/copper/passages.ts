// Module 3: the customer documents, cut into passages and embedded. The file
// is made by `npm run ingest` (scripts/ingest-docs.mts) and loaded into memory
// once, when the app starts, so finding passages never reads a PDF.
import data from "./data/passages.json";

export type Passage = {
  /** "<documentId>-p<page>-<n>", unique across every document. */
  id: string;
  /** The document's id in lib/copper/documents.ts. */
  documentId: string;
  /** The document's title, which the text also starts with. */
  title: string;
  /** 1-based page number in the PDF. */
  page: number;
  /** "<title>: <a few sentences from that page>" */
  text: string;
  /** The passage as a vector from EMBEDDING_MODEL (lib/ai/models.ts). */
  embedding: number[];
};

export type PassageFile = {
  /** The embedding model id that made the vectors. */
  model: string;
  /** Numbers per vector. */
  dimensions: number;
  /** When `npm run ingest` ran. */
  createdAt: string;
  passages: Passage[];
};

const file = data as PassageFile;

/** Every passage from every document, in document and page order. */
export function getPassages(): Passage[] {
  return file.passages;
}

/** Which model made the vectors, and how long they are. */
export function getPassageIndexInfo(): Omit<PassageFile, "passages"> {
  const { model, dimensions, createdAt } = file;
  return { model, dimensions, createdAt };
}

/** How many passages each document produced, by document id. */
export function countPassagesByDocument(
  passages: Passage[] = file.passages,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of passages)
    counts[p.documentId] = (counts[p.documentId] ?? 0) + 1;
  return counts;
}
