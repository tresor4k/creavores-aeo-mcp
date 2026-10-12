import { fetchJson } from "../lib/fetch.js";

const SOURCE_URL = "https://lescreavores.fr/data/marronniers-2026-2027.json";
const CITATION = {
  text: "Calendrier des marronniers 2026-2027",
  url: "https://lescreavores.fr/outils/generateur-calendrier-editorial/",
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getMarronniersTool = {
  name: "get_marronniers",
  description:
    "Returns live French editorial calendar dates ('marronniers') for Sept 2026 to Dec 2027 from the Les Créavores open dataset: world days, holidays, school holidays, seasons, public holidays and retail events, each with start/end date, label, type, sectors, source and a content angle. Optional filters: from/to (YYYY-MM-DD, overlap match), sector (also returns dates common to all sectors, 'tous') and limit. Every answer carries source, licence, date and citation.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (events ending on or after it)" },
      to: { type: "string", description: "End date YYYY-MM-DD (events starting on or before it)" },
      sector: { type: "string", description: "Sector as written in the dataset, e.g. sante, beaute, artisanat, restauration, immobilier, commerce, b2b" },
      limit: { type: "integer", minimum: 1, maximum: 500, description: "Maximum number of events returned (default 50)" },
    },
  },
  async handler({ from, to, sector, limit = 50 } = {}) {
    for (const [name, v] of [["from", from], ["to", to]]) {
      // The regex alone accepted "2027-13-45": round-trip through Date to reject impossible dates.
      if (v !== undefined && (!DATE_RE.test(String(v)) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) {
        return { error: `Invalid ${name}: expected a real date YYYY-MM-DD, got "${v}"` };
      }
    }
    const max = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 50;

    const res = await fetchJson(SOURCE_URL);
    if (!res.ok) return { error: res.error, source: SOURCE_URL };
    if (!Array.isArray(res.data)) return { error: "Unexpected file format: expected an array", source: SOURCE_URL };

    // An unknown sector used to return only the 'tous' dates, silently: tell the caller which sectors exist.
    if (sector) {
      const known = [...new Set(res.data.flatMap((e) => String(e.secteurs || "").split(",").map((x) => x.trim())))]
        .filter((s) => s && s !== "tous")
        .sort();
      if (!known.includes(sector)) return { error: `Unknown sector "${sector}"`, available_sectors: known, source: SOURCE_URL };
    }

    const matches = res.data.filter((e) => {
      const end = e.dateFin || e.date;
      if (from && end < from) return false;
      if (to && e.date > to) return false;
      if (sector) {
        const list = String(e.secteurs || "").split(",").map((x) => x.trim());
        if (!list.includes(sector) && !list.includes("tous")) return false;
      }
      return true;
    });

    return {
      source: SOURCE_URL,
      licence: null,
      licence_note: "No licence is declared in the file.",
      generated_at: null,
      last_modified: res.headers["last-modified"] ?? null,
      date_note: "The file carries no generation date; last_modified is the HTTP Last-Modified header of the file.",
      citation: CITATION,
      total_in_file: res.data.length,
      total_matches: matches.length,
      returned: Math.min(matches.length, max),
      events: matches.slice(0, max),
    };
  },
};
