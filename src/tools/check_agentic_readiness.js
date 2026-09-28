import { loadPage } from "../lib/page.js";
import { checkLlmsTxt } from "../lib/llmstxt.js";
import { checkRobotsForAiBots } from "../lib/robots.js";

// Differentiator tool: aligned with Lighthouse's emerging "Agentic Browsing"
// category — can an AI agent (not just a search-index crawler) navigate,
// read, and act on this page reliably?
export const checkAgenticReadinessTool = {
  name: "check_agentic_readiness",
  description:
    "Assesses how readable and navigable a page is for AI agents performing 'agentic browsing' (Claude, ChatGPT agents, Perplexity, etc.), not just traditional search crawlers. Checks: llms.txt compliance, heading structure sanity, image alt-text coverage, ARIA landmarks/labels, meta robots directives, and whether AI-specific crawlers are blocked in robots.txt. Aligned with Lighthouse's new Agentic Browsing audit category.",
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

    const [llms, robots] = await Promise.all([
      checkLlmsTxt(snapshot.origin || url).catch((e) => ({ error: String(e) })),
      checkRobotsForAiBots(url).catch((e) => ({ error: String(e) })),
    ]);

    const altCoverage = snapshot.imagesTotal > 0 ? snapshot.imagesWithAlt / snapshot.imagesTotal : 1;
    const isNoindex = /noindex/.test(snapshot.metaRobots || "") || snapshot.xRobotsNoindex;
    const blockedBots = robots && !robots.error ? robots.bots.filter((b) => b.blocked).map((b) => b.name) : [];

    const checks = [
      {
        check: "llms-txt",
        pass: Boolean(llms && llms.exists && llms.score >= 60),
        detail: llms && !llms.error ? `exists=${llms.exists}, score=${llms.score}` : llms && llms.error,
        weight: 20,
        recommendation: "Publish a spec-compliant llms.txt to give agents a token-efficient map of the site.",
      },
      {
        check: "ai-crawlers-not-blocked",
        pass: blockedBots.length === 0,
        detail: blockedBots.length ? `Blocked: ${blockedBots.join(", ")}` : "No AI crawler blocked",
        weight: 20,
        recommendation: `Remove robots.txt Disallow rules for AI agents (${blockedBots.join(", ") || "GPTBot, ClaudeBot, PerplexityBot..."}) if you want this page cited.`,
      },
      {
        check: "not-noindex",
        pass: !isNoindex,
        detail: snapshot.metaRobots || "no meta robots directive",
        weight: 15,
        recommendation: "Remove the noindex directive — a noindex page is invisible to both search and AI engines.",
      },
      {
        check: "heading-hierarchy",
        pass: !snapshot.hierarchyJump && snapshot.h1Count === 1,
        detail: `h1Count=${snapshot.h1Count}, hierarchyJump=${snapshot.hierarchyJump}`,
        weight: 15,
        recommendation: "Use exactly one H1 and avoid skipping heading levels — agents parse structure to build a page outline.",
      },
      {
        check: "image-alt-text",
        pass: altCoverage >= 0.8,
        detail: `${snapshot.imagesWithAlt}/${snapshot.imagesTotal} images have alt text (${Math.round(altCoverage * 100)}%)`,
        weight: 10,
        recommendation: "Add descriptive alt text to images — agents that can't render images rely on alt text to understand visual content.",
      },
      {
        check: "aria-landmarks",
        pass: snapshot.ariaLandmarkCount >= 2,
        detail: `${snapshot.ariaLandmarkCount} landmark(s) (main/nav/header/footer/role=*) detected`,
        weight: 10,
        recommendation: "Use semantic landmarks (<main>, <nav>, <header>, <footer>) or explicit ARIA roles so agents can jump to the relevant page region.",
      },
      {
        check: "viewport-meta",
        pass: Boolean(snapshot.viewport),
        detail: snapshot.viewport || "missing",
        weight: 5,
        recommendation: "Add a responsive viewport meta tag — many agentic browsers render at mobile viewport widths.",
      },
      {
        check: "canonical-declared",
        pass: Boolean(snapshot.canonical),
        detail: snapshot.canonical || "missing",
        weight: 5,
        recommendation: "Declare a canonical URL so agents dedupe correctly across parameterized/tracked URLs.",
      },
    ];

    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const score = Math.round((checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0) / totalWeight) * 100);

    return {
      url,
      score,
      verdict: score >= 80 ? "agent-ready" : score >= 50 ? "partially-ready" : "not-ready",
      checks,
      topRecommendations: checks
        .filter((c) => !c.pass)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map((c) => c.recommendation),
    };
  },
};
