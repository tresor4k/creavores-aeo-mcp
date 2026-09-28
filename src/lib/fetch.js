const USER_AGENT = "creavores-aeo-mcp/1.0 (+https://lescreavores.fr)";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Fetches a URL with a strict timeout and an identifiable User-Agent.
 * Never throws — always resolves to a result object, so callers can
 * return a clean {error} payload instead of crashing the MCP tool call.
 */
export async function fetchText(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  let normalizedUrl;
  try {
    normalizedUrl = new URL(url).toString();
  } catch {
    return { ok: false, error: `Invalid URL: "${url}"` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(normalizedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...headers,
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      finalUrl: res.url || normalizedUrl,
      contentType,
      headers: Object.fromEntries(res.headers.entries()),
      text,
    };
  } catch (err) {
    const isAbort = err && err.name === "AbortError";
    return {
      ok: false,
      error: isAbort
        ? `Timeout after ${timeoutMs}ms fetching ${normalizedUrl}`
        : `Fetch failed for ${normalizedUrl}: ${err && err.message ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export { USER_AGENT, DEFAULT_TIMEOUT_MS };
