import { fetchJson } from "../lib/fetch.js";

const SOURCE_URL = "https://lescreavores.fr/data/observatoire-achat-site-internet/reference-prix.json";
const CITATION = {
  text: "Les Créavores, Observatoire de l'achat de sites internet",
  url: "https://lescreavores.fr/observatoire-achat-site-internet/",
};

export const getPrixSiteTool = {
  name: "get_prix_site",
  description:
    "Returns live French website pricing data from the Les Créavores open dataset (prices publicly displayed by web agencies and freelancers): one cell per 'type|unit' (e.g. 'vitrine|forfait', 'maintenance|mensuel') with sample size n, number of distinct providers and p10/p25/p50/p75/p90 in euros. Optional filters by type and unit; only publishable cells are returned by default. Every answer carries source, licence, generation date and citation.",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "Site/service type as written in the dataset, e.g. vitrine, e-commerce, one_page, seo, maintenance" },
      unit: { type: "string", description: "Pricing unit as written in the dataset, e.g. forfait (one-off) or mensuel (monthly)" },
      include_unpublishable: { type: "boolean", description: "Also return cells flagged publiable=false (default false)" },
    },
  },
  async handler({ type, unit, include_unpublishable = false } = {}) {
    const res = await fetchJson(SOURCE_URL);
    if (!res.ok) return { error: res.error, source: SOURCE_URL };
    const d = res.data;
    const offre = d && typeof d.offre === "object" ? d.offre : null;
    if (!offre) return { error: "Unexpected file format: no 'offre' object", source: SOURCE_URL };

    const keys = Object.keys(offre);
    const cells = {};
    for (const key of keys) {
      const [t, u] = key.split("|");
      if (type && t !== type) continue;
      if (unit && u !== unit) continue;
      if (!include_unpublishable && offre[key] && offre[key].publiable === false) continue;
      cells[key] = offre[key];
    }
    if (!Object.keys(cells).length && (type || unit)) {
      return {
        error: `No cell matches type=${type ?? "*"} unit=${unit ?? "*"}`,
        available_cells: keys,
        source: SOURCE_URL,
      };
    }

    const src = Array.isArray(d.sources) ? d.sources.find((s) => s.id === "prix_affiches") : null;
    return {
      source: SOURCE_URL,
      licence: src ? src.licence : null,
      generated_at: d.genere_le ?? null,
      version: d.version ?? null,
      citation: CITATION,
      note: d.note ?? null,
      currency: "EUR",
      cells,
      meta: d.offre_meta ?? null,
      collection: src ?? null,
    };
  },
};
