import { fetchText } from "./fetch.js";
import { buildSnapshot } from "./extract.js";

/**
 * Fetches a URL and builds its snapshot in one step.
 * Returns { ok: false, error } on any failure — never throws.
 */
export async function loadPage(url) {
  const res = await fetchText(url);
  if (!res.ok) {
    return { ok: false, error: res.error || `HTTP ${res.status} ${res.statusText} for ${url}` };
  }
  const snapshot = buildSnapshot(res.text, { url: res.finalUrl || url });
  // Header-level noindex (X-Robots-Tag) is only knowable from the real response.
  const xRobotsTag = (res.headers && (res.headers["x-robots-tag"] || res.headers["X-Robots-Tag"])) || "";
  snapshot.xRobotsNoindex = snapshot.xRobotsNoindex || /noindex/i.test(xRobotsTag);
  return { ok: true, res, snapshot };
}
