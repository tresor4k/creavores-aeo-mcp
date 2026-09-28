import { fetchText, originOf } from "./fetch.js";

// Spec: https://llmstxt.org/
// Required: an H1 title as the very first line ("# Name").
// Recommended: a blockquote short summary right after the title.
// Body: zero or more "## Section" headings, each containing a Markdown
// link list: "- [Title](URL): optional notes".
const H1_RE = /^#\s+.+/m;
const BLOCKQUOTE_RE = /^>\s+.+/m;
const SECTION_RE = /^##\s+.+/gm;
const MD_LINK_LIST_ITEM_RE = /^-\s*\[([^\]]+)\]\(([^)]+)\)(:\s*(.*))?$/gm;

export async function checkLlmsTxt(domain) {
  let origin;
  try {
    origin = domain.startsWith("http") ? originOf(domain) : `https://${domain.replace(/\/$/, "")}`;
  } catch {
    return { error: `Invalid domain: "${domain}"` };
  }
  if (!origin) return { error: `Invalid domain: "${domain}"` };

  const url = `${origin.replace(/\/$/, "")}/llms.txt`;
  const res = await fetchText(url, { timeoutMs: 10000 });

  // Many hosts answer a missing path with their homepage in HTTP 200 (soft 404).
  // Trusting the status alone would report a llms.txt that does not exist.
  const isSoftFourOhFour =
    res.ok &&
    ((res.contentType || "").toLowerCase().includes("html") ||
      /^\s*(<!doctype html|<html[\s>])/i.test(res.text || "") ||
      /<html[\s>]|<head[\s>]|<body[\s>]/i.test((res.text || "").slice(0, 1000)));

  if (!res.ok || isSoftFourOhFour) {
    return {
      domain: origin,
      url,
      exists: false,
      score: 0,
      verdict: "missing",
      issues: [
        {
          severity: "high",
          code: "missing",
          message: res.error
            ? `Could not fetch ${url}: ${res.error}`
            : isSoftFourOhFour
              ? `${url} returned HTTP ${res.status} but served an HTML page (soft 404): no llms.txt is actually published at this path.`
              : `${url} returned HTTP ${res.status}. llms.txt is a widely-adopted (though not universally standardized) convention that gives AI crawlers a curated, token-efficient map of your site.`,
        },
      ],
      recommendation: "Publish an llms.txt file at the domain root following the spec at https://llmstxt.org/.",
    };
  }

  const body = res.text || "";
  const hasH1 = H1_RE.test(body);
  const hasBlockquote = BLOCKQUOTE_RE.test(body);
  const sections = body.match(SECTION_RE) || [];
  const links = [...body.matchAll(MD_LINK_LIST_ITEM_RE)].map((m) => ({
    title: m[1],
    url: m[2],
    notes: m[4] || "",
  }));

  const issues = [];
  let points = 0;

  if (hasH1) points += 30;
  else issues.push({ severity: "high", code: "no-h1-title", message: "The file does not start with an H1 title ('# Name') as required by the spec." });

  if (hasBlockquote) points += 15;
  else issues.push({ severity: "low", code: "no-summary", message: "No blockquote summary (> ...) found right after the title (recommended, not required)." });

  if (sections.length >= 1) points += 15;
  else issues.push({ severity: "medium", code: "no-sections", message: "No '## Section' headings found to organize links." });

  if (links.length >= 5) points += 40;
  else if (links.length >= 1) {
    points += 20;
    issues.push({ severity: "low", code: "few-links", message: `Only ${links.length} Markdown link(s) found — add more curated links to key pages (docs, pricing, about).` });
  } else {
    issues.push({ severity: "high", code: "no-links", message: "No Markdown link list items ('- [Title](URL): notes') found — the file provides no navigable content." });
  }

  const score = Math.min(100, points);
  const verdict = score >= 80 ? "compliant" : score >= 40 ? "partial" : "non-compliant";

  return {
    domain: origin,
    url,
    exists: true,
    httpStatus: res.status,
    score,
    verdict,
    hasH1Title: hasH1,
    hasSummary: hasBlockquote,
    sectionCount: sections.length,
    sections: sections.map((s) => s.replace(/^##\s+/, "")),
    linkCount: links.length,
    links: links.slice(0, 30),
    issues,
  };
}
