import { fetchJson } from "../lib/fetch.js";

const REF_URL = "https://lescreavores.fr/data/observatoire-achat-site-internet/reference-prix.json";
const STATS_URL = "https://lescreavores.fr/data/observatoire-achat-site-internet/stats.json";
const CITATION = {
  text: "Les Créavores, Observatoire de l'achat de sites internet",
  url: "https://lescreavores.fr/observatoire-achat-site-internet/",
};
const PUBLIC_SOURCES = ["decp_2022", "decp_v3", "boamp"];

export const getMarchesPublicsTool = {
  name: "get_marches_publics",
  description:
    "Returns live aggregates of French public procurement contracts for websites (DECP open data, plus BOAMP price weighting) from the Les Créavores open dataset: amounts excl. VAT (n, q1, median, q3) per 'category|buyer type' (website creation/redesign, maintenance/hosting, SEO/marketing), number of bids received, yearly breakdown and publication thresholds. Optional filter by buyer type (e.g. commune, departement, region, epci_syndicat, universite, hopital_etab_sante, autres, tous). Every answer carries sources, licence, generation date and citation.",
  inputSchema: {
    type: "object",
    properties: {
      buyer_type: { type: "string", description: "Buyer type as written in the dataset, e.g. commune, departement, region, epci_syndicat, universite, hopital_etab_sante, autres, tous" },
      include_unpublishable: { type: "boolean", description: "Also return cells flagged publiable=false (default false)" },
    },
  },
  async handler({ buyer_type, include_unpublishable = false } = {}) {
    const sources = [REF_URL, STATS_URL];
    const [ref, stats] = await Promise.all([fetchJson(REF_URL), fetchJson(STATS_URL)]);
    if (!ref.ok) return { error: ref.error, source: sources };
    if (!stats.ok) return { error: stats.error, source: sources };
    const r = ref.data;
    const s = stats.data || {};
    if (!r || typeof r.decp !== "object") return { error: "Unexpected file format: no 'decp' object", source: REF_URL };

    const keys = Object.keys(r.decp);
    const cells = {};
    for (const key of keys) {
      if (buyer_type && key.split("|")[1] !== buyer_type) continue;
      if (!include_unpublishable && r.decp[key] && r.decp[key].publiable === false) continue;
      cells[key] = r.decp[key];
    }
    if (buyer_type && !Object.keys(cells).length) {
      return {
        error: `No cell matches buyer_type=${buyer_type}`,
        available_buyer_types: [...new Set(keys.map((k) => k.split("|")[1]))],
        source: sources,
      };
    }

    let decpDetail = s.decp ?? null;
    if (decpDetail && buyer_type && decpDetail.par_type_acheteur) {
      const pick = decpDetail.par_type_acheteur[buyer_type];
      decpDetail = { ...decpDetail, par_type_acheteur: pick ? { [buyer_type]: pick } : {} };
    }

    return {
      source: sources,
      licence: s.licence ?? null,
      generated_at: r.genere_le ?? null,
      data_collected: s.date_collecte ?? null,
      version: r.version ?? null,
      citation: CITATION,
      currency: "EUR",
      amounts_excl_vat_by_category_and_buyer: cells,
      bids_received_by_category: r.decp_offres_recues ?? null,
      boamp_price_weighting: r.boamp_poids_prix ?? null,
      decp_detail: decpDetail,
      publication_thresholds: s.seuils_publication_decp ?? null,
      collection: Array.isArray(r.sources) ? r.sources.filter((x) => PUBLIC_SOURCES.includes(x.id)) : null,
    };
  },
};
