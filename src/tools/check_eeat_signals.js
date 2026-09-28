import { loadPage } from "../lib/page.js";

export const checkEeatSignalsTool = {
  name: "check_eeat_signals",
  description:
    "Checks Experience-Expertise-Authoritativeness-Trustworthiness (E-E-A-T) signals on a page: byline/author, publish/modified dates, source citations (external links), links to an About/Methodology page, and legal-notice/privacy links. These signals matter for YMYL topics and for AI engines assessing whether to trust and cite a source.",
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
    const checks = [
      {
        signal: "author-byline",
        present: snapshot.hasAuthorSignal,
        detail: snapshot.metaAuthor || snapshot.bylineText || null,
        weight: "high",
        recommendation: "Add a visible byline (author name, credentials) and/or an author JSON-LD field.",
      },
      {
        signal: "publish-or-modified-date",
        present: snapshot.hasDateSignal,
        detail: null,
        weight: "high",
        recommendation: "Add a visible publish/updated date and a <time datetime> tag or article:published_time meta.",
      },
      {
        signal: "source-citations",
        present: snapshot.hasSourceCitations,
        detail: `${snapshot.externalLinksCount} external link(s) detected`,
        weight: "medium",
        recommendation: "Cite external sources (studies, data, official docs) with outbound links.",
      },
      {
        signal: "about-page-link",
        present: snapshot.hasAboutLink,
        detail: null,
        weight: "medium",
        recommendation: "Link to an About / Who-we-are page from this page (footer or nav is fine).",
      },
      {
        signal: "methodology-page-link",
        present: snapshot.hasMethodologyLink,
        detail: null,
        weight: "medium",
        recommendation: "For data-driven or YMYL content, link to a /methodology page explaining how figures/claims were produced.",
      },
      {
        signal: "legal-notice-link",
        present: snapshot.hasLegalLink,
        detail: null,
        weight: "low",
        recommendation: "Link to legal notices / privacy policy / terms — a baseline trust signal.",
      },
      {
        signal: "organization-schema",
        present: snapshot.jsonLdTypes.some((t) => ["Organization", "WebSite", "LocalBusiness"].includes(t)),
        detail: snapshot.jsonLdTypes.join(", ") || null,
        weight: "medium",
        recommendation: "Add Organization or LocalBusiness JSON-LD to establish entity identity.",
      },
    ];

    const presentCount = checks.filter((c) => c.present).length;
    const weightPoints = { high: 20, medium: 12, low: 6 };
    const maxScore = checks.reduce((sum, c) => sum + weightPoints[c.weight], 0);
    const score = Math.round(
      (checks.reduce((sum, c) => sum + (c.present ? weightPoints[c.weight] : 0), 0) / maxScore) * 100
    );

    return {
      url,
      score,
      verdict: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak",
      signalsPresent: presentCount,
      signalsTotal: checks.length,
      checks,
      topRecommendations: checks
        .filter((c) => !c.present)
        .sort((a, b) => weightPoints[b.weight] - weightPoints[a.weight])
        .slice(0, 5)
        .map((c) => c.recommendation),
    };
  },
};
