// Module 3: cuts the text of one PDF page into passages of a few sentences.
// A passage is what Ask Copper will find and quote, so each one should read on
// its own: whole sentences, never cut mid-word, never crossing a page.

export type SplitOptions = {
  /** Stop adding sentences once a passage has this many. */
  maxSentences?: number;
  /** Stop adding sentences once a passage is this long (characters). */
  maxChars?: number;
  /** A final passage shorter than this joins the one before it. */
  minChars?: number;
};

const DEFAULTS: Required<SplitOptions> = {
  maxSentences: 4,
  maxChars: 600,
  minChars: 150,
};

/** Collapses line breaks and runs of spaces that PDF text extraction leaves. */
export function cleanPageText(text: string): string {
  return text
    .replace(/-\s*\n\s*(?=[a-z])/g, "") // a word hyphen-ated across lines
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits text into sentences. A new sentence starts after . ! or ? and a space, when a capital, digit or quote follows. */
export function splitSentences(text: string): string[] {
  return cleanPageText(text)
    .split(/(?<=[.!?]["”')\]]?)\s+(?=["“(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Groups a page's sentences into passages of a few sentences each. */
export function splitIntoPassages(
  pageText: string,
  options: SplitOptions = {},
): string[] {
  const { maxSentences, maxChars, minChars } = { ...DEFAULTS, ...options };
  const sentences = splitSentences(pageText);
  const passages: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    const wouldBe = length + sentence.length + (current.length ? 1 : 0);
    if (
      current.length &&
      (current.length >= maxSentences || wouldBe > maxChars)
    ) {
      passages.push(current.join(" "));
      current = [];
      length = 0;
    }
    current.push(sentence);
    length += sentence.length + (current.length > 1 ? 1 : 0);
  }
  if (current.length) passages.push(current.join(" "));

  // A short tail (a page's last line, say) reads better attached to the
  // passage before it.
  const last = passages.at(-1);
  if (passages.length > 1 && last && last.length < minChars) {
    passages.pop();
    passages[passages.length - 1] += " " + last;
  }
  return passages;
}
