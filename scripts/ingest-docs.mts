// npm run ingest: reads every PDF in lib/copper/documents.ts (served from
// public/docs/), cuts each page into passages of a few sentences, embeds them
// with Gemini's embedding model through lib/ai/call.ts, and saves everything
// to lib/copper/data/passages.json, which the app loads when it starts.
// Run it again whenever a PDF changes. Needs GOOGLE_GENERATIVE_AI_API_KEY in
// .env.local (the npm script loads that file).
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractText } from "unpdf";
import { callEmbed, isAiConfigured } from "@/lib/ai/call";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";
import type { Passage, PassageFile } from "@/lib/copper/passages";
import { splitIntoPassages } from "@/lib/copper/split-passages";

const OUT = join("lib", "copper", "data", "passages.json");
/** Passages per embedding request: well under Google's batch limit of 100. */
const BATCH = 50;

if (!isAiConfigured()) {
  console.error(
    "ingest: GOOGLE_GENERATIVE_AI_API_KEY isn't set. Add it to .env.local and run `npm run ingest` again.",
  );
  process.exit(1);
}

type Draft = Omit<Passage, "embedding">;

const drafts: Draft[] = [];
const report: { title: string; pages: number; passages: number }[] = [];

for (const doc of DOCUMENTS) {
  const path = join("public", doc.file);
  const bytes = new Uint8Array(await readFile(path));
  const { totalPages, text } = await extractText(bytes, { mergePages: false });
  let count = 0;
  text.forEach((pageText, index) => {
    const page = index + 1;
    splitIntoPassages(pageText).forEach((body, n) => {
      drafts.push({
        id: `${doc.id}-p${page}-${n + 1}`,
        documentId: doc.id,
        title: doc.title,
        page,
        // The title first, so a passage read on its own says which document it is from.
        text: `${doc.title}: ${body}`,
      });
      count++;
    });
  });
  report.push({ title: doc.title, pages: totalPages, passages: count });
  console.log(`${doc.title}: ${totalPages} pages, ${count} passages`);
}

console.log(
  `Embedding ${drafts.length} passages with ${EMBEDDING_MODEL.id}...`,
);
const vectors: number[][] = [];
for (let i = 0; i < drafts.length; i += BATCH) {
  const batch = drafts.slice(i, i + BATCH);
  const embeddings = await callEmbed(
    { module: 3, feature: "ingest-docs" },
    { values: batch.map((d) => d.text), taskType: "RETRIEVAL_DOCUMENT" },
  );
  // Six decimals is plenty for similarity and keeps the file about half the size.
  vectors.push(...embeddings.map((v) => v.map((x) => Number(x.toFixed(6)))));
  console.log(`  ${Math.min(i + BATCH, drafts.length)} / ${drafts.length}`);
}

const out: PassageFile = {
  model: EMBEDDING_MODEL.id,
  dimensions: EMBEDDING_MODEL.dimensions,
  createdAt: new Date().toISOString(),
  passages: drafts.map((d, i) => ({ ...d, embedding: vectors[i] })),
};
await writeFile(OUT, JSON.stringify(out) + "\n");

console.log(`\nSaved ${out.passages.length} passages to ${OUT}\n`);
console.table(report);
