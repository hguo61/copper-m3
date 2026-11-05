// The search_docs tool card: each passage shows its document, page and a link
// that opens the PDF on that page.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLive } from "@/lib/ai/live";
import type { Progress } from "@/lib/copper/assistant/progress";

const SEARCH_RESULT = {
  question: "How do I reset Wi-Fi?",
  matches: [
    {
      id: "copper-home-user-guide-p4-2",
      title: "Copper Home User Guide",
      page: 4,
      text: "Hold the action button for ten seconds to reset the Wi-Fi settings.",
      url: "/docs/copper-home-user-guide.pdf#page=4",
      score: 0.81,
      documentId: "copper-home-user-guide",
    },
    {
      id: "copper-plus-faq-p2-1",
      title: "Copper Plus FAQ",
      page: 2,
      text: "Copper Plus does not change how the device connects to Wi-Fi.",
      url: "/docs/copper-plus-faq.pdf#page=2",
      score: 0.62,
      documentId: "copper-plus-faq",
    },
  ],
};

const PROGRESS: Progress = {
  steps: [
    {
      type: "tool",
      id: "call-1",
      name: "search_docs",
      state: "done",
      input: { question: "How do I reset Wi-Fi?" },
      output: SEARCH_RESULT,
    },
  ],
  reply:
    "Hold the action button for ten seconds (Copper Home User Guide, page 4).",
  status: "done",
};

vi.mock("@/lib/copper/assistant/ask", () => ({
  askCopper: async () => {
    const { live, done } = createLive<Progress>();
    done(PROGRESS);
    return { progress: live };
  },
}));

afterEach(() => cleanup());

describe("search_docs tool card", () => {
  it("lists each passage with its document, page and a link to that PDF page", async () => {
    const { AskCopper } = await import("@/components/copper/ask-copper");
    render(<AskCopper aiConfigured />);
    fireEvent.click(screen.getByTestId("ask-copper-launcher"));
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "How do I reset Wi-Fi?" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    const list = await waitFor(() => screen.getByTestId("doc-matches"));
    const links = list.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "/docs/copper-home-user-guide.pdf#page=4",
    );
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveTextContent("Copper Home User Guide");
    expect(links[0]).toHaveTextContent("page 4");
    expect(list).toHaveTextContent("Hold the action button for ten seconds");
    expect(screen.getByText(/Copper Home User Guide, page 4/)).toBeDefined();
    // The tool is offered in the rail and marked as used.
    expect(screen.getByTestId("tool-call")).toHaveAttribute(
      "data-tool",
      "search_docs",
    );
  });
});
