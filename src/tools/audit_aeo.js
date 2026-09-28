import { loadPage } from "../lib/page.js";
import { scoreSnapshot, topRecommendations } from "../lib/scoring.js";
import { checkLlmsTxt } from "../lib/llmstxt.js";
import { checkRobotsForAiBots } from "../lib/robots.js";

export const auditAeoTool = {
  name: "audit_aeo",
  description:
    "Runs a full Answer Engine Optimization (AEO) audit on a URL: crawlability (30pts), content structure for AI extraction (35pts), and E-E-A-T trust signals (35pts), plus llms.txt and AI-bot access checks. Returns a 0-100 score, sub-scores, a verdict, and prioritized, actionable recommendations.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the page to audit, e.g. https://example.com/page" },
    },
    required: ["url"],
  },
  async handler({ url }) {
    const page = await loadPage(url);
    if (!page.ok) return { error: page.error, url };

    const { snapshot, res } = page;
    const result = scoreSnapshot(snapshot);

    const [llms, robots] = await Promise.all([
      checkLlmsTxt(snapshot.origin || url).catch((e) => ({ error: String(e) })),
      checkRobotsForAiBots(url).catch((e) => ({ error: String(e) })),
    ]);

    const extraIssues = [];
    if (llms && llms.exists === false) {
      extraIssues.push({ severity: "medium", code: "no-llms-txt", message: "No llms.txt found — AI agents get no curated, token-efficient map of the site." });
    }
    if (robots && robots.blockedCount > 0) {
      const blockedNames = robots.bots.filter((b) => b.blocked).map((b) => b.name).join(", ");
      extraIssues.push({ severity: "high", code: "ai-bot-blocked", message: `robots.txt blocks these AI crawlers/agents: ${blockedNames}.` });
    }

    const allIssues = [...result.issues, ...extraIssues];

    return {
      url: res.finalUrl || url,
      httpStatus: res.status,
      score: result.score,
      max: 100,
      verdict: result.verdict,
      subScores: {
        crawlability: { score: result.subScores.crawlability.score, max: 30 },
        structure: { score: result.subScores.structure.score, max: 35 },
        trust: { score: result.subScores.trust.score, max: 35 },
      },
      llmsTxt: llms && !llms.error ? { exists: llms.exists, score: llms.score, verdict: llms.verdict } : { error: llms && llms.error },
      aiBotAccess: robots && !robots.error ? { blockedCount: robots.blockedCount, bots: robots.bots } : { error: robots && robots.error },
      issueCount: allIssues.length,
      topRecommendations: topRecommendations(allIssues, 8),
      issues: allIssues,
      pageSignals: {
        title: snapshot.title,
        h1: snapshot.h1Text,
        h1Count: snapshot.h1Count,
        wordCount: snapshot.wordCount,
        jsonLdTypes: snapshot.jsonLdTypes,
        hasFaqSchema: snapshot.hasFaqSchema,
        hasDateSignal: snapshot.hasDateSignal,
        hasAuthorSignal: snapshot.hasAuthorSignal,
      },
    };
  },
};
