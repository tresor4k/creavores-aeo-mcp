import { loadPage } from "../lib/page.js";
import { scoreSnapshot } from "../lib/scoring.js";

export const compareAeoTool = {
  name: "compare_aeo",
  description:
    "Compares the AEO scores of 2 to 3 URLs side by side (e.g. your page vs. one or two competitors). Returns each URL's overall score, sub-scores, ranking, and the biggest gaps to close to beat the top-ranked one.",
  inputSchema: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 3,
        description: "2 to 3 full URLs to compare.",
      },
    },
    required: ["urls"],
  },
  async handler({ urls }) {
    if (!Array.isArray(urls) || urls.length < 2 || urls.length > 3) {
      return { error: "Provide between 2 and 3 URLs in the 'urls' array." };
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        const page = await loadPage(url);
        if (!page.ok) return { url, error: page.error };
        const scored = scoreSnapshot(page.snapshot);
        return {
          url,
          score: scored.score,
          verdict: scored.verdict,
          subScores: {
            crawlability: scored.subScores.crawlability.score,
            structure: scored.subScores.structure.score,
            trust: scored.subScores.trust.score,
          },
          topIssues: scored.issues.slice(0, 3).map((i) => i.message),
        };
      })
    );

    const ranked = results
      .filter((r) => !r.error)
      .slice()
      .sort((a, b) => b.score - a.score);

    const leader = ranked[0] || null;
    const comparison = ranked.map((r, i) => ({
      rank: i + 1,
      url: r.url,
      score: r.score,
      gapToLeader: leader ? leader.score - r.score : 0,
    }));

    const gapsToClose = [];
    if (leader) {
      for (const r of ranked.slice(1)) {
        for (const dim of ["crawlability", "structure", "trust"]) {
          const diff = leader.subScores[dim] - r.subScores[dim];
          if (diff >= 5) {
            gapsToClose.push(`${r.url} trails ${leader.url} by ${diff}pts on ${dim} — see topIssues for that URL.`);
          }
        }
      }
    }

    return {
      results,
      ranking: comparison,
      leader: leader ? leader.url : null,
      gapsToClose,
    };
  },
};
