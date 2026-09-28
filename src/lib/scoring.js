// Scoring logic ported and extended from @macalc/aeo-score (site2/aeo-score)
// and the tools-api /api/aeo-scan route (lescreavores-tools-api.vercel.app),
// both © Les Créavores. Same 30/35/35 weighting so scores stay comparable
// with https://lescreavores.fr/outils/audit-aeo-gratuit/.

function pushIssue(issues, severity, code, message) {
  issues.push({ severity, code, message });
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
export function sortIssues(issues) {
  return [...issues].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
}

/** Crawlability / accessibility to bots — 30 pts max. */
export function scoreCrawlabilite(snap) {
  const issues = [];
  let points = 0;

  const isNoindex = /noindex/.test(snap.metaRobots || "") || snap.xRobotsNoindex;
  if (!isNoindex) points += 12;
  else pushIssue(issues, "high", "noindex", "The page is set to noindex — it cannot be indexed or cited by AI search engines.");

  if (snap.jsonLdValidCount > 0) points += 8;
  else pushIssue(issues, "high", "no-json-ld", "No valid JSON-LD structured data found — AI engines rely heavily on structured data to understand page content.");

  if (snap.lang) points += 4;
  else pushIssue(issues, "medium", "no-lang", "The <html> tag has no lang attribute declared.");

  if (snap.canonical) points += 4;
  else pushIssue(issues, "low", "no-canonical", "No canonical link found.");

  if (snap.jsonLdValidCount > 0 && snap.jsonLdInvalidCount === 0) points += 2;
  else if (snap.jsonLdInvalidCount > 0)
    pushIssue(issues, "medium", "invalid-json-ld", `${snap.jsonLdInvalidCount} JSON-LD block(s) failed to parse.`);

  return { score: Math.min(30, points), max: 30, issues };
}

/** Content structure for AI extraction — 35 pts max. */
export function scoreStructure(snap) {
  const issues = [];
  let points = 0;

  if (snap.h1Count === 1) points += 6;
  else pushIssue(issues, "high", "h1-count", `Found ${snap.h1Count} H1 tag(s) — exactly 1 is expected.`);

  if (snap.headings.length > 1 && !snap.hierarchyJump) points += 5;
  else if (snap.hierarchyJump)
    pushIssue(issues, "low", "heading-jump", "Heading hierarchy skips a level (e.g. H2 straight to H4) — confuses content parsers.");

  const answerLen = (snap.answerAfterH1 || "").length;
  if (answerLen >= 40 && answerLen <= 320) {
    points += 8;
  } else if (answerLen > 320 && answerLen <= 600) {
    points += 4;
    pushIssue(issues, "low", "answer-too-long", "The paragraph after the H1 is longer than ideal for a direct-answer snippet (aim for 40-60 words).");
  } else {
    pushIssue(issues, "high", "no-direct-answer", "No concise answer paragraph (40-60 words) found directly under the H1.");
  }

  if (snap.questionHeadingCount >= 2) points += 8;
  else if (snap.questionHeadingCount === 1) {
    points += 4;
    pushIssue(issues, "low", "few-question-headings", "Only 1 subheading phrased as a question — add more to match conversational AI queries.");
  } else {
    pushIssue(issues, "medium", "no-question-headings", "No H2/H3 subheadings phrased as questions.");
  }

  if (snap.hasFaqSchema || snap.faqHeading || snap.detailsCount >= 2) points += 8;
  else pushIssue(issues, "medium", "no-faq", "No FAQ section (schema, heading, or accordion) detected.");

  if (snap.wordCount > 0 && snap.wordCount < 300)
    pushIssue(issues, "medium", "thin-content", `Only ~${snap.wordCount} words — thin content is rarely cited by AI engines.`);

  return { score: Math.min(35, points), max: 35, issues };
}

/** Trust / E-E-A-T signals — 35 pts max. */
export function scoreConfiance(snap) {
  const issues = [];
  let points = 0;

  if (snap.jsonLdTypes.length > 0) points += 4;

  const orgTypes = ["Organization", "WebSite", "LocalBusiness"];
  if (snap.jsonLdTypes.some((t) => orgTypes.includes(t))) points += 5;
  else pushIssue(issues, "medium", "no-org-schema", "No Organization/WebSite/LocalBusiness schema found.");

  const contentTypes = ["Article", "BlogPosting", "NewsArticle", "WebPage", "Product", "Service", "Recipe", "HowTo"];
  if (snap.jsonLdTypes.some((t) => contentTypes.includes(t))) points += 5;
  else pushIssue(issues, "low", "no-content-type-schema", "No declared content-type schema (Article, Product, Service...).");

  if (snap.jsonLdTypes.some((t) => ["FAQPage", "HowTo", "QAPage"].includes(t))) points += 6;

  if (snap.hasDateSignal) points += 6;
  else pushIssue(issues, "medium", "no-date", "No publish/modified date signal found (time tag, meta, or JSON-LD).");

  if (snap.hasAuthorSignal) points += 5;
  else pushIssue(issues, "low", "no-author", "No author/byline signal found.");

  if (snap.externalLinksCount >= 2) points += 4;
  else pushIssue(issues, "low", "few-external-links", "Fewer than 2 external links — citing sources builds trust for AI engines.");

  if (!snap.title) pushIssue(issues, "high", "no-title", "Missing <title> tag.");
  if (!snap.metaDescription) pushIssue(issues, "low", "no-meta-description", "Missing meta description.");

  return { score: Math.min(35, points), max: 35, issues };
}

export function scoreSnapshot(snap) {
  const crawl = scoreCrawlabilite(snap);
  const structure = scoreStructure(snap);
  const confiance = scoreConfiance(snap);
  const score = crawl.score + structure.score + confiance.score;
  const issues = sortIssues([...crawl.issues, ...structure.issues, ...confiance.issues]);
  return {
    score,
    max: 100,
    verdict: verdictFor(score),
    subScores: {
      crawlability: crawl,
      structure,
      trust: confiance,
    },
    issues,
  };
}

export function verdictFor(score) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "needs-work";
  return "poor";
}

export function topRecommendations(issues, limit = 5) {
  return sortIssues(issues)
    .slice(0, limit)
    .map((i) => i.message);
}
