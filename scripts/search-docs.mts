// npm run search -- "your question": tries search_docs from the terminal and
// prints the closest passages with their document, page and link. Handy for
// checking what Ask Copper will see before asking it in the chat.
import { searchDocs } from "@/lib/copper/search";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run search -- "How do I reset Wi-Fi?"');
  process.exit(1);
}

const { matches } = await searchDocs(question);
console.log(`\n"${question}"\n`);
matches.forEach((m, i) => {
  console.log(
    `${i + 1}. ${m.title}, page ${m.page}  (score ${m.score})  ${m.url}`,
  );
  console.log(
    `   ${m.text.length > 220 ? m.text.slice(0, 220) + "…" : m.text}\n`,
  );
});
