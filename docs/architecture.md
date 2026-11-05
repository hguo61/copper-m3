# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 3 starter: Ask Copper

**Summary:** Ask Copper, the Module 2 shopping chatbot, finished: a floating
chat panel that answers prices, totals and stock with four tools and shows
each step. Module 3 teaches it to answer from the customer documents.

| Piece | Where | What it does |
|---|---|---|
| Component | `components/copper/ask-copper.tsx` | The launcher and chat panel, mounted from `app/page.tsx` and opened by the header's `#ask` link. Draws each answer as stations: the tools on offer, thinking, each tool call, then the reply |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper()`: streams the conversation with `callStream`, up to 5 steps, and sends each step back as a live `Progress` |
| Tools | `lib/copper/assistant/tools.ts` | `copperTools`: `get_products`, `get_prices`, `calculate_cost`, `check_availability` |
| Instructions | `lib/copper/assistant/instructions.ts` | `COPPER_INSTRUCTIONS`. Copper says it can't help yet with warranty, setup, troubleshooting or privacy |
| Data | `lib/copper/inventory.ts`, `lib/copper/documents.ts` | Stock from `lib/copper/data/inventory.json`; `DOCUMENTS`: the four customer documents and their PDF paths under `public/docs/`. The PDFs are added in class |
| AI calls | `{ module: 2, feature: "ask-copper" }` | One streamed call per question |

## Module 3: Ask Copper answers from the documents

**Summary:** The four customer PDFs are cut into passages of a few sentences,
each embedded with Gemini's embedding model and saved to one JSON file the app
loads at start. This is the index Ask Copper will search to answer warranty,
setup, troubleshooting and privacy questions with the page they came from.

| Piece | Where | What it does |
|---|---|---|
| Documents | `public/docs/*.pdf`, `lib/copper/documents.ts` | The PDFs, served at `/docs/<id>.pdf`; `DOCUMENTS` gives each one's title |
| Ingest | `scripts/ingest-docs.mts` (`npm run ingest`) | Reads every PDF page (`unpdf`), splits it into passages, embeds them in batches of 50 and writes the data file. Run again when a PDF changes |
| Splitter | `lib/copper/split-passages.ts` | `splitIntoPassages`: up to 4 sentences or 600 characters per passage, whole sentences only, never across pages; a short tail joins the passage before it |
| Data | `lib/copper/data/passages.json` | `{ model, dimensions, createdAt, passages[] }`; each passage has `id`, `documentId`, `title`, `page`, `text` (which starts with the title) and `embedding` |
| Search | `lib/copper/search.ts` | `searchDocs(question)`: embeds the question (task type `RETRIEVAL_QUERY`), scores every passage by cosine similarity and returns the 5 closest with `id`, `title`, `page`, `text`, `url` (`/docs/<id>.pdf#page=N`) and `score`. `npm run search -- "question"` tries it from the terminal |
| Tool | `search_docs` in `lib/copper/assistant/tools.ts` | Copper's fifth tool. The instructions send every setup, troubleshooting, warranty, refund, privacy and terms question to it and tell Copper to answer only from the passages, naming the document and page |
| Tool card | `components/copper/ask-copper.tsx` | Draws each match as a numbered row: document title and page as a link that opens the PDF on that page (new tab), then the passage |
| Loader | `lib/copper/passages.ts` | `getPassages()`, `getPassageIndexInfo()`, `countPassagesByDocument()`: the file is imported once, so lookups are in memory |
| Embedding model | `lib/ai/models.ts` `EMBEDDING_MODEL`, `lib/ai/pricing.ts` | `gemini-embedding-001` at 768 dimensions, $0.15 per million tokens read |
| AI calls | `callEmbed` in `lib/ai/call.ts`, `{ module: 3, feature: "ingest-docs" }` and `{ module: 3, feature: "search-docs" }` | One row per batch of passages. Google's embedding API reports no token counts, so `input_tokens` and `cost_usd` are null; at $0.15 per million tokens, re-ingesting all four PDFs costs well under one cent |

**Data flow:** `npm run ingest` → PDF pages → passages (title first) →
`callEmbed` (task type `RETRIEVAL_DOCUMENT`) → `passages.json` → imported by
`lib/copper/passages.ts` when the app starts. Then, per question: shopper asks
→ `askCopper` streams to Gemini with the tools → Gemini calls `search_docs` →
`searchDocs` embeds the question (`RETRIEVAL_QUERY`), ranks the passages in
memory → 5 matches back to Gemini → reply that cites document and page, with the
matches drawn in the tool card.

**Decisions and trade-offs:** Passages are split by sentences, not a fixed
number of characters, so each one reads whole and can be quoted. The title is
put at the front of every passage's text so that a passage found on its own
still says which product it is about. Vectors are 768 numbers rather than the
model's full 3072: the file stays small enough to commit and load in memory,
and retrieval quality for a few hundred passages is unchanged. The JSON is
committed, so Vercel serves it with no database and no key at build time.

**Risks and open questions:** The file must be regenerated when a PDF
changes (there is no check that it is current). PDF text extraction can
garble tables and headers, which become part of a passage. Search is a plain
scan over 94 vectors, which is instant here; a much larger library would need
a vector database. The model is told to answer only from the passages, but
that is an instruction, not a guarantee, which is why the card shows the
source pages for anyone to check.
