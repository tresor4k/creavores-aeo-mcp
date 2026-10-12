<!-- MCP server (stdio): AEO audits of any URL + French open data (web prices, tenders), free. -->
# creavores-aeo-mcp

An MCP (Model Context Protocol) server that audits any URL for **AEO (Answer Engine Optimization)** and AI-search readiness. It checks what ChatGPT, Perplexity, Google AI Overviews and agentic browsers look for: a citable direct answer, valid JSON-LD, `llms.txt` compliance, E-E-A-T trust signals, and whether AI crawlers and agents can read and navigate the page.

Built by [Les Créavores](https://lescreavores.fr/), a web & SEO/AEO agency. Same scoring engine as the browser version: the [free AEO audit tool](https://lescreavores.fr/outils/audit-aeo-gratuit/). Source code: [github.com/tresor4k/creavores-aeo-mcp](https://github.com/tresor4k/creavores-aeo-mcp) (MIT).

## Run

```bash
docker run -i --rm tresor4k/creavores-aeo-mcp
```

The server speaks JSON-RPC over stdio (keep `-i`). No API key, no configuration, no environment variable. It needs outbound network access to fetch the pages you audit. The container runs as the unprivileged `node` user.

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "creavores-aeo": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "tresor4k/creavores-aeo-mcp"]
    }
  }
}
```

Claude Code: `claude mcp add creavores-aeo -- docker run -i --rm tresor4k/creavores-aeo-mcp`

## The 11 tools

| Tool | Input | What it does |
|---|---|---|
| `audit_aeo` | `url` | Full AEO audit: crawlability (30 pts), content structure for AI extraction (35 pts), E-E-A-T trust (35 pts), plus `llms.txt` and AI-bot access checks. Returns a 0-100 score, a verdict and prioritized recommendations. |
| `check_direct_answer` | `url` | Detects a 40-60 word direct-answer paragraph right under the H1. |
| `extract_structured_data` | `url` | Extracts and validates every JSON-LD block: types found, parse errors, common schema.org mistakes, and whether the data ships server-side. |
| `check_llms_txt` | `domain` | Checks existence and [llmstxt.org](https://llmstxt.org/) spec compliance of `llms.txt`. |
| `check_eeat_signals` | `url` | Byline/author, publish and modified dates, source citations, About/Methodology and legal-notice links, Organization schema. |
| `check_agentic_readiness` | `url` | Is the page readable and navigable by an AI agent: `llms.txt`, AI-crawler access in `robots.txt`, heading hierarchy, image alt-text coverage, ARIA landmarks, viewport meta and canonical. |
| `simulate_ai_citation` | `url` | Finds the single passage an AI engine is most likely to quote, and explains why (or why not). |
| `compare_aeo` | `urls` (2-3) | Compares the AEO scores of 2-3 URLs side by side. |
| `get_prix_site` | `type`, `unit` (optional) | Live French website prices from our open dataset (prices displayed by agencies and freelancers): n, distinct providers, p10 to p90 per service type and unit. |
| `get_marches_publics` | `buyer_type` (optional) | Live aggregates of French public procurement for websites (DECP, BOAMP): amounts excl. VAT per category and buyer type, bids received. |
| `get_marronniers` | `from`, `to`, `sector`, `limit` (optional) | Live French editorial calendar dates (Sept 2026 to Dec 2027) with sectors, source and a content angle. |

The 3 data tools read our open files live on lescreavores.fr and return `source`, `licence`, date and a `citation` to link ([Observatoire de l'achat de sites internet](https://lescreavores.fr/observatoire-achat-site-internet/)). Every tool returns clean JSON, including `{ "error": "..." }` on failure, so it is safe to call from any agent loop. Pages are fetched with a self-identifying User-Agent and a 15-second timeout.

## Other ways to run it

- npm: `npx -y creavores-aeo-mcp`
- Official MCP registry: `io.github.tresor4k/creavores-aeo-mcp`

## En français

Serveur MCP qui audite n'importe quelle URL pour l'AEO (optimisation pour les moteurs de réponse IA) : réponse directe, JSON-LD, `llms.txt`, signaux E-E-A-T, lisibilité par les agents IA. Trois outils servent aussi nos données ouvertes : prix affichés des sites internet, marchés publics de sites web, calendrier des marronniers. Gratuit, sans clé d'API. Version navigateur : [audit AEO gratuit](https://lescreavores.fr/outils/audit-aeo-gratuit/) par [Les Créavores](https://lescreavores.fr/), agence web et SEO/AEO de la métropole de Metz.
