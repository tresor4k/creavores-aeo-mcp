import { loadPage } from "../lib/page.js";

const COMMON_MISTAKES = [];

function checkCommonMistakes(block) {
  const mistakes = [];
  if (!block.parsed || typeof block.parsed !== "object") return mistakes;
  const nodes = Array.isArray(block.parsed) ? block.parsed : block.parsed["@graph"] ? block.parsed["@graph"] : [block.parsed];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (!node["@context"] && !Array.isArray(block.parsed)) {
      // only flag on the top-level object, @graph children don't need their own @context
    }
    if (!node["@type"]) mistakes.push("Missing @type on a JSON-LD node.");
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes("FAQPage")) {
      const items = node.mainEntity;
      if (!items || (Array.isArray(items) && items.length === 0)) {
        mistakes.push("FAQPage has no mainEntity Question items.");
      } else {
        const arr = Array.isArray(items) ? items : [items];
        arr.forEach((q, i) => {
          if (!q.name) mistakes.push(`FAQPage Question #${i + 1} is missing 'name'.`);
          if (!q.acceptedAnswer || !q.acceptedAnswer.text) mistakes.push(`FAQPage Question #${i + 1} is missing 'acceptedAnswer.text'.`);
        });
      }
    }
    if (types.includes("Product") && !node.offers) mistakes.push("Product schema is missing 'offers'.");
    if (types.includes("Article") || types.includes("BlogPosting") || types.includes("NewsArticle")) {
      if (!node.headline) mistakes.push(`${types.find((t) => /Article$/.test(t))} is missing 'headline'.`);
      if (!node.datePublished) mistakes.push("Article-type schema is missing 'datePublished'.");
      if (!node.author) mistakes.push("Article-type schema is missing 'author'.");
    }
    if (types.includes("BreadcrumbList") && (!node.itemListElement || node.itemListElement.length === 0)) {
      mistakes.push("BreadcrumbList has no itemListElement.");
    }
  }
  return mistakes;
}

export const extractStructuredDataTool = {
  name: "extract_structured_data",
  description:
    "Extracts and validates all JSON-LD structured data on a page: parses every <script type=\"application/ld+json\"> block, reports @type list, JSON parse errors, common schema.org mistakes (missing required fields), and confirms the data is present server-side in the raw HTML (not injected client-side via useEffect, which AI crawlers may not execute).",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL of the page to inspect." },
    },
    required: ["url"],
  },
  async handler({ url }) {
    const page = await loadPage(url);
    if (!page.ok) return { error: page.error, url };

    const { snapshot } = page;
    const blocks = snapshot.jsonLdBlocks.map((b, i) => ({
      index: i,
      valid: b.valid,
      parseError: b.error,
      types: b.valid
        ? (() => {
            const t = b.parsed && b.parsed["@type"];
            return t ? (Array.isArray(t) ? t : [t]) : b.parsed && b.parsed["@graph"] ? "see @graph" : [];
          })()
        : null,
      commonMistakes: b.valid ? checkCommonMistakes(b) : [],
      raw: b.raw.length > 2000 ? b.raw.slice(0, 2000) + "…(truncated)" : b.raw,
    }));

    const allMistakes = blocks.flatMap((b) => b.commonMistakes);

    return {
      url,
      blockCount: blocks.length,
      validCount: snapshot.jsonLdValidCount,
      invalidCount: snapshot.jsonLdInvalidCount,
      serverSideRendered: blocks.length > 0, // fetched raw HTML — if blocks are present here, they are not client-injected
      typesFound: snapshot.jsonLdTypes,
      blocks,
      commonMistakes: allMistakes,
      verdict:
        blocks.length === 0
          ? "missing"
          : snapshot.jsonLdInvalidCount > 0
          ? "invalid"
          : allMistakes.length > 0
          ? "incomplete"
          : "valid",
      recommendation:
        blocks.length === 0
          ? "Add JSON-LD structured data server-side (e.g. Organization + the relevant content type + FAQPage where applicable). AI engines use it to understand entities and facts without re-parsing prose."
          : snapshot.jsonLdInvalidCount > 0
          ? "Fix the JSON parse errors — malformed JSON-LD is silently ignored by search/AI engines."
          : allMistakes.length > 0
          ? "Fill in the missing required fields listed in commonMistakes to make the schema fully valid per schema.org."
          : "Structured data looks valid. Consider adding a Dataset or HowTo type if relevant to strengthen entity coverage.",
    };
  },
};
