import * as cheerio from "cheerio";

// FR + EN question-word detector, mirrors the heuristic used by
// @macalc/aeo-score (site2/aeo-score/src/snapshot.js) so the AEO scores
// produced by this MCP stay comparable with the public /outils/audit-aeo-gratuit/ tool.
const QUESTION_WORDS =
  /\b(comment|pourquoi|quand|que|qu['’]|quelle?s?|qui|où|combien|est-ce|how|why|what|when|where|which|who|can|should|is|are|do|does)\b/i;

const FAQ_HEADING_RE = /\bfaq\b|questions?\s+fr[ée]quentes/i;

/**
 * Builds a structured "snapshot" of a page from raw HTML.
 * Pure, no network access — same shape as the aeo-score package's
 * buildSnapshot(), extended with a few extra signals (images, ARIA,
 * tables, meta robots) needed by the extra MCP tools.
 */
export function buildSnapshot(html, { url } = {}) {
  const $ = cheerio.load(html || "");
  let pageOrigin = null;
  try {
    pageOrigin = url ? new URL(url).origin : null;
  } catch {
    pageOrigin = null;
  }

  // ---- JSON-LD ----
  const jsonLdBlocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    let parsed = null;
    let error = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      error = err.message;
    }
    jsonLdBlocks.push({ raw, parsed, error, valid: error === null });
  });

  const jsonLdTypes = new Set();
  let hasFaqSchema = false;
  let hasDateInJsonLd = false;
  let hasAuthorInJsonLd = false;

  const collectTypes = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(collectTypes);
      return;
    }
    const t = node["@type"];
    if (t) {
      (Array.isArray(t) ? t : [t]).forEach((type) => jsonLdTypes.add(String(type)));
      const flat = Array.isArray(t) ? t : [t];
      if (flat.some((type) => /faq|qapage/i.test(String(type)))) hasFaqSchema = true;
    }
    if (node.datePublished || node.dateModified || node.dateCreated) hasDateInJsonLd = true;
    if (node.author) hasAuthorInJsonLd = true;
    if (node["@graph"]) collectTypes(node["@graph"]);
    Object.values(node).forEach((v) => {
      if (v && typeof v === "object") collectTypes(v);
    });
  };
  jsonLdBlocks.filter((b) => b.valid).forEach((b) => collectTypes(b.parsed));

  // ---- Headings ----
  const headings = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.slice(1));
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!text) return;
    const isQuestion = QUESTION_WORDS.test(text) || /\?\s*$/.test(text);
    headings.push({ level, text, isQuestion });
  });
  const h1s = headings.filter((h) => h.level === 1);

  // heading hierarchy sanity: no level jump > 1 downward (e.g. H2 -> H4)
  let hierarchyJump = false;
  let prevLevel = null;
  for (const h of headings) {
    if (prevLevel !== null && h.level > prevLevel + 1) hierarchyJump = true;
    prevLevel = h.level;
  }

  const faqHeading = headings.some((h) => FAQ_HEADING_RE.test(h.text));
  const detailsCount = $("details").length;

  // ---- Meta ----
  const title = $("head > title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const metaRobots = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  const xRobotsNoindex = false; // header-level check happens in tools that have access to response headers
  const lang = $("html").attr("lang") || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const viewport = $('meta[name="viewport"]').attr("content") || "";

  // ---- First paragraph / answer block ----
  let firstParagraphText = "";
  const bodyParas = $("p")
    .toArray()
    .map((el) => $(el).text().trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (bodyParas.length) firstParagraphText = bodyParas[0];

  // Text directly following the H1 (more precise "direct answer" probe)
  let answerAfterH1 = "";
  if (h1s.length) {
    const h1El = $("h1").first();
    let node = h1El.next();
    let guard = 0;
    while (node.length && guard < 6) {
      const tag = (node.prop("tagName") || "").toLowerCase();
      const text = node.text().trim().replace(/\s+/g, " ");
      if (tag === "p" && text) {
        answerAfterH1 = text;
        break;
      }
      if (tag && /^h[1-6]$/.test(tag)) break; // hit next heading before finding a paragraph
      node = node.next();
      guard += 1;
    }
  }
  if (!answerAfterH1) answerAfterH1 = firstParagraphText;

  // ---- Word count ----
  $("script, style, noscript").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;

  // ---- Links ----
  const links = $("a[href]")
    .toArray()
    .map((el) => $(el).attr("href"))
    .filter(Boolean);
  const externalLinks = [];
  const internalLinks = [];
  for (const href of links) {
    try {
      const abs = new URL(href, url || undefined).toString();
      const host = new URL(abs).host;
      if (pageOrigin && new URL(abs).origin === pageOrigin) internalLinks.push(abs);
      else if (/^https?:/.test(abs)) externalLinks.push(abs);
    } catch {
      // ignore mailto:, tel:, javascript:, relative-without-base
    }
  }

  // ---- Date signals ----
  const hasTimeTag = $("time[datetime], time").length > 0;
  const metaPublished =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[property="article:modified_time"]').attr("content") ||
    "";
  const hasDateSignal = hasTimeTag || Boolean(metaPublished) || hasDateInJsonLd;

  // ---- Author signals ----
  const metaAuthor = $('meta[name="author"]').attr("content") || "";
  const relAuthor = $('[rel="author"]').length > 0;
  const bylineText = $('[class*="byline" i], [class*="author" i]').first().text().trim();
  const hasAuthorSignal = Boolean(metaAuthor) || relAuthor || hasAuthorInJsonLd || Boolean(bylineText);

  // ---- Images / alt text ----
  const images = $("img").toArray();
  const imagesTotal = images.length;
  const imagesWithAlt = images.filter((el) => {
    const alt = $(el).attr("alt");
    return typeof alt === "string" && alt.trim().length > 0;
  }).length;

  // ---- ARIA / roles ----
  const ariaLandmarkCount = $(
    '[role="main"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="search"],main,nav,header,footer'
  ).length;
  const ariaLabelCount = $("[aria-label], [aria-labelledby]").length;

  // ---- Lists / tables (citable structures) ----
  const listCount = $("ul, ol").length;
  const listItemsTotal = $("li").length;
  const tableCount = $("table").length;

  // ---- Links to about / methodology / legal ----
  const linkTexts = $("a[href]")
    .toArray()
    .map((el) => ({
      href: $(el).attr("href") || "",
      text: $(el).text().trim().toLowerCase(),
    }));
  const hasAboutLink = linkTexts.some(
    (l) => /about|à-propos|a-propos|qui-sommes/i.test(l.href) || /à propos|about us|who we are/i.test(l.text)
  );
  const hasMethodologyLink = linkTexts.some(
    (l) => /methodology|m[ée]thodologie/i.test(l.href) || /methodology|m[ée]thodologie/i.test(l.text)
  );
  const hasLegalLink = linkTexts.some(
    (l) =>
      /mentions-legales|legal-notice|privacy|confidentialite|cgu|cgv|terms/i.test(l.href) ||
      /mentions légales|privacy policy|confidentialité|conditions générales|terms of service/i.test(l.text)
  );
  const hasSourceCitations =
    externalLinks.length >= 2 ||
    /\b(source|sources|selon|according to|étude|study|données de|data from)\b/i.test(bodyText);

  return {
    url: url || null,
    origin: pageOrigin,
    title,
    metaDescription,
    metaRobots,
    xRobotsNoindex,
    lang,
    canonical,
    viewport,
    jsonLdBlocks,
    jsonLdTypes: Array.from(jsonLdTypes),
    jsonLdValidCount: jsonLdBlocks.filter((b) => b.valid).length,
    jsonLdInvalidCount: jsonLdBlocks.filter((b) => !b.valid).length,
    hasFaqSchema,
    hasDateInJsonLd,
    hasAuthorInJsonLd,
    headings,
    h1Count: h1s.length,
    h1Text: h1s[0] ? h1s[0].text : "",
    hierarchyJump,
    faqHeading,
    detailsCount,
    questionHeadingCount: headings.filter((h) => h.level >= 2 && h.level <= 3 && h.isQuestion).length,
    firstParagraphText,
    answerAfterH1,
    wordCount,
    internalLinksCount: internalLinks.length,
    externalLinksCount: externalLinks.length,
    externalLinks: externalLinks.slice(0, 20),
    hasDateSignal,
    hasAuthorSignal,
    metaAuthor,
    bylineText,
    imagesTotal,
    imagesWithAlt,
    ariaLandmarkCount,
    ariaLabelCount,
    listCount,
    listItemsTotal,
    tableCount,
    hasAboutLink,
    hasMethodologyLink,
    hasLegalLink,
    hasSourceCitations,
  };
}
