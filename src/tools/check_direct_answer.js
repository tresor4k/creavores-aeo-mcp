import { loadPage } from "../lib/page.js";

function wordCount(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export const checkDirectAnswerTool = {
  name: "check_direct_answer",
  description:
    "Checks whether a page has a concise 40-60 word direct-answer paragraph right under the H1 — the single strongest citability signal for AI/answer engines (ChatGPT, Perplexity, Google AI Overviews). Returns the detected passage, its word count, and a pass/fail verdict.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the page to check." },
    },
    required: ["url"],
  },
  async handler({ url }) {
    const page = await loadPage(url);
    if (!page.ok) return { error: page.error, url };

    const { snapshot } = page;
    const answer = snapshot.answerAfterH1 || "";
    const words = wordCount(answer);
    const chars = answer.length;

    let verdict;
    let recommendation;
    if (!answer) {
      verdict = "fail";
      recommendation = "No paragraph found directly under the H1. Add a 40-60 word direct answer to the primary question the page addresses, placed immediately after the H1, before any other content.";
    } else if (words >= 30 && words <= 70) {
      verdict = "pass";
      recommendation = "Direct answer length is in the citable range. Make sure it fully answers the query implied by the H1 without requiring the reader to scroll.";
    } else if (words < 30) {
      verdict = "too-short";
      recommendation = `Only ${words} words — expand to 40-60 words so the passage stands alone as a complete answer.`;
    } else {
      verdict = "too-long";
      recommendation = `${words} words is too long for a single citable snippet — trim to 40-60 words and move supporting detail below.`;
    }

    return {
      url: url,
      h1: snapshot.h1Text,
      hasH1: snapshot.h1Count > 0,
      detectedAnswer: answer,
      wordCount: words,
      charCount: chars,
      idealRange: "40-60 words (approx. 250-350 characters)",
      verdict,
      recommendation,
    };
  },
};
