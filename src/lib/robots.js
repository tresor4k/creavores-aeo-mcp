import { fetchText, originOf } from "./fetch.js";

// The AI crawlers/agents most likely to matter for AEO/agentic-browsing
// readiness in 2026: answer-engine indexers and live browsing agents.
export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
];

function parseRobotsTxt(body) {
  const lines = (body || "").split(/\r?\n/);
  const groups = []; // { agents: [], disallow: [] }
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = (rawKey || "").trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.disallow.length || current.allow.length) {
        current = { agents: [value], disallow: [], allow: [] };
        groups.push(current);
      } else {
        current.agents.push(value);
      }
    } else if (key === "disallow" && current) {
      if (value) current.disallow.push(value);
    } else if (key === "allow" && current) {
      if (value) current.allow.push(value);
    }
  }
  return groups;
}

function isBlockedForBot(groups, botName) {
  const specific = groups.filter((g) => g.agents.some((a) => a.toLowerCase() === botName.toLowerCase()));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const applicable = specific.length ? specific : wildcard;
  if (!applicable.length) return { blocked: false, matchedGroup: null };
  const blockedAll = applicable.some((g) => g.disallow.some((d) => d === "/" || d === ""));
  return { blocked: blockedAll, matchedGroup: applicable[0] };
}

export async function checkRobotsForAiBots(url) {
  const origin = originOf(url);
  if (!origin) return { error: `Invalid URL: "${url}"` };

  const robotsUrl = `${origin}/robots.txt`;
  const res = await fetchText(robotsUrl, { timeoutMs: 10000 });
  if (!res.ok) {
    return {
      robotsUrl,
      exists: false,
      note: res.error || `HTTP ${res.status} — no robots.txt found, so no AI bot is explicitly blocked.`,
      bots: AI_BOTS.map((name) => ({ name, blocked: false })),
      blockedCount: 0,
    };
  }

  const groups = parseRobotsTxt(res.text);
  const bots = AI_BOTS.map((name) => {
    const { blocked } = isBlockedForBot(groups, name);
    return { name, blocked };
  });

  return {
    robotsUrl,
    exists: true,
    bots,
    blockedCount: bots.filter((b) => b.blocked).length,
  };
}
