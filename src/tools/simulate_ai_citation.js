import * as cheerio from "cheerio";
import { fetchText } from "../lib/fetch.js";

function clean(text) {
  return (text || "").trim().replace(/\s+/g, " ");
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// Heuristic self-containedness score: does the passage read as a complete
// thought without external context (no leading pronoun, has a verb-like
// pattern, reasonable length, ideally contains a number/definition).
function scorePassage(text) {
  const words = wordCount(text);
  let score = 0;
  const reasons = [];

  if (words >= 15 && words <= 80) {
    score += 40;
  } else if (words > 0) {
    score += 15;
    reasons.push(words < 15 ? "too short to stand alone" : "long — may get truncated when cited");
  }

  if (!/^(this|that|these|those|it|elle|il|celui|celle|ceci|cela)\b/i.test(text)) {
    score += 15;
  } else {
    reasons.push("starts with a pronoun referring to prior context — ambiguous if quoted alone");
  }

  if (/\d/.test(text)) {
    score += 15;
    reasons.push("contains a concrete number/stat — strong citation signal");
  }

  if (/\b(is|are|means|refers to|est|sont|désigne|permet de)\b/i.test(text)) {
    score += 15;
    reasons.push("has a definitional structure ('X is/means Y')");
  }

  if (/[.!?]$/.test(text.trim())) {
    score += 15;
  } else {
    reasons.push("does not end with terminal punctuation — may be a sentence fragment");
  }

  return { score: Math.min(100, score), reasons };
}

export const simulateAiCitationTool = {
  name: "simulate_ai_citation",
  description:
    "Simulates how an AI answer engine (ChatGPT, Perplexity, AI Overviews) would extract a citable passage from a page. Scans paragraphs, list items, table rows, and FAQ answers, scores each for self-containedness (length, no dangling pronouns, presence of numbers/definitions), and returns the single most citable passage plus an explanation of why it would (or would not) be picked over the others.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the page to analyze." },
    },
    required: ["url"],
  },
  async handler({ url }) {
    const res = await fetchText(url);
    if (!res.ok) return { error: res.error || `HTTP ${res.status} for ${url}`, url };

    const $ = cheerio.load(res.text);
    $("script, style, noscript, nav, footer").remove();

    const candidates = [];

    // Paragraph directly after H1
    const h1 = $("h1").first();
    if (h1.length) {
      const p = h1.nextAll("p").first();
      const text = clean(p.text());
      if (text) candidates.push({ type: "direct-answer", context: "Paragraph under H1", text });
    }

    // Other paragraphs (top 8 by length in a reasonable range)
    $("p")
      .toArray()
      .slice(0, 40)
      .forEach((el) => {
        const text = clean($(el).text());
        if (text && text.length > 40) candidates.push({ type: "paragraph", context: "Body paragraph", text });
      });

    // List items grouped as one candidate per list (joined) — lists are highly citable for "top N" queries
    $("ul, ol")
      .toArray()
      .slice(0, 10)
      .forEach((el) => {
        const items = $(el)
          .find("> li")
          .toArray()
          .map((li) => clean($(li).text()))
          .filter(Boolean);
        if (items.length >= 2) {
          candidates.push({
            type: "list",
            context: `List with ${items.length} items`,
            text: items.slice(0, 6).join(" | "),
            items: items.slice(0, 10),
          });
        }
      });

    // Table rows — first table only, as a structured-data candidate
    const firstTable = $("table").first();
    if (firstTable.length) {
      const rows = firstTable
        .find("tr")
        .toArray()
        .slice(0, 6)
        .map((tr) =>
          $(tr)
            .find("th, td")
            .toArray()
            .map((cell) => clean($(cell).text()))
            .join(" | ")
        )
        .filter(Boolean);
      if (rows.length) {
        candidates.push({ type: "table", context: "Table (structured comparison data)", text: rows.join(" // "), rows });
      }
    }

    // FAQ-style Q&A: heading-that-looks-like-a-question followed by a paragraph
    $("h2, h3").each((_, el) => {
      const heading = clean($(el).text());
      if (!heading) return;
      const isQuestion = /\?\s*$/.test(heading);
      if (!isQuestion) return;
      const answer = clean($(el).nextAll("p").first().text());
      if (answer) {
        candidates.push({ type: "faq-answer", context: `Answer to: "${heading}"`, text: `${heading} ${answer}` });
      }
    });

    if (!candidates.length) {
      return {
        url,
        verdict: "not-citable",
        explanation: "No paragraph, list, table, or FAQ answer with enough substance was found. AI engines have nothing extractable to cite from this page.",
      };
    }

    const scored = candidates
      .map((c) => ({ ...c, ...scorePassage(c.text) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];

    return {
      url,
      bestCandidate: {
        type: best.type,
        context: best.context,
        text: best.text.length > 500 ? best.text.slice(0, 500) + "…" : best.text,
        citabilityScore: best.score,
        reasons: best.reasons,
      },
      wouldBeCited: best.score >= 60,
      explanation:
        best.score >= 60
          ? `This ${best.type.replace("-", " ")} is the most likely passage an AI engine would extract and cite: ${best.reasons.join("; ") || "well-formed, self-contained sentence"}.`
          : `Even the best candidate (a ${best.type.replace("-", " ")}) scores only ${best.score}/100 — the page lacks a strong, self-contained passage that reads well when quoted out of context.`,
      runnerUp: runnerUp
        ? { type: runnerUp.type, context: runnerUp.context, citabilityScore: runnerUp.score }
        : null,
      candidatesEvaluated: scored.length,
      recommendation:
        best.score < 60
          ? "Rewrite the top passage as a self-contained 1-2 sentence statement: state the subject, avoid leading pronouns, include a concrete number or definition, and end with terminal punctuation."
          : "Passage is solid. To strengthen further, ensure it also appears verbatim (or near-verbatim) in any FAQPage JSON-LD for maximum consistency across surfaces.",
    };
  },
};
