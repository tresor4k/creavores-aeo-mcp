# creavores-aeo-mcp

An MCP (Model Context Protocol) server that audits any URL for **AEO (Answer Engine Optimization)** and AI-search readiness — a practical diagnostic tool, not a gadget. It checks the same things ChatGPT, Perplexity, Google AI Overviews, and agentic browsers actually look for: a citable direct answer, valid JSON-LD, `llms.txt` compliance, E-E-A-T trust signals, and whether AI crawlers/agents can read and navigate the page at all.

Built by [Les Créavores](https://lescreavores.fr), a web & SEO/AEO agency. The scoring logic is compatible with (and extends) the public [`@macalc/aeo-score`](https://www.npmjs.com/package/@macalc/aeo-score) package and the [free AEO audit tool](https://lescreavores.fr/outils/audit-aeo-gratuit/) — scores you get here match what you'd see there.

## Installation

No install step needed — run it directly with `npx`:

```bash
npx creavores-aeo-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "creavores-aeo": {
      "command": "npx",
      "args": ["-y", "creavores-aeo-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add creavores-aeo -- npx -y creavores-aeo-mcp
```

Or add it to `.mcp.json` at the root of your project:

```json
{
  "mcpServers": {
    "creavores-aeo": {
      "command": "npx",
      "args": ["-y", "creavores-aeo-mcp"]
    }
  }
}
```

No API key, no configuration, no environment variables required. The server fetches pages directly with a self-identifying User-Agent (`creavores-aeo-mcp/1.0 (+https://lescreavores.fr)`), a 15-second timeout, and never throws — every tool returns clean JSON (including `{ "error": "..." }` on failure) so it's safe to call from any agent loop.

## Tools

### 1. `audit_aeo`

Full AEO audit: crawlability (30 pts) + content structure for AI extraction (35 pts) + E-E-A-T trust (35 pts), plus `llms.txt` and AI-bot access checks. Returns a 0-100 score, a verdict, and prioritized recommendations.

```json
{ "url": "https://example.com/pricing" }
```

→ `{ score: 78, verdict: "good", subScores: {...}, topRecommendations: [...], issues: [...] }`

### 2. `check_direct_answer`

Detects a 40-60 word direct-answer paragraph right under the H1 — the strongest single citability signal for AI engines.

```json
{ "url": "https://example.com/pricing" }
```

### 3. `extract_structured_data`

Extracts and validates every JSON-LD block: types found, parse errors, common schema.org mistakes (missing `acceptedAnswer`, missing `datePublished`, etc.), and confirms the data ships server-side (not injected client-side via `useEffect`, which many AI crawlers never execute).

```json
{ "url": "https://example.com/pricing" }
```

### 4. `check_llms_txt`

Checks existence and [llmstxt.org](https://llmstxt.org/) spec compliance: H1 title, blockquote summary, `## Section` headings, and Markdown link list items.

```json
{ "domain": "example.com" }
```

### 5. `check_eeat_signals`

Byline/author, publish/modified dates, source citations, About/Methodology page links, legal-notice links, Organization schema.

```json
{ "url": "https://example.com/blog/article" }
```

### 6. `check_agentic_readiness`

**Differentiator tool**, aligned with Lighthouse's new "Agentic Browsing" audit category: is this page readable and navigable by an AI *agent* (not just a search crawler)? Checks `llms.txt`, AI-crawler access in `robots.txt`, heading hierarchy, image alt-text coverage, ARIA landmarks, viewport meta, and canonical.

```json
{ "url": "https://example.com/app" }
```

### 7. `simulate_ai_citation`

Simulates how an AI engine would extract a citable passage: scans paragraphs, list items, table rows, and FAQ answers, scores each for self-containedness, and returns the single passage most likely to be quoted — with an explanation of why (or why not).

```json
{ "url": "https://example.com/blog/article" }
```

### 8. `compare_aeo`

Compares 2-3 URLs' AEO scores side by side — use it to benchmark yourself against a competitor.

```json
{ "urls": ["https://example.com", "https://competitor.com"] }
```

## About

Made by [Les Créavores](https://lescreavores.fr), a French web & SEO/AEO agency (Metz, France & Luxembourg). We build the tools we use ourselves — see the free [AEO audit tool](https://lescreavores.fr/outils/audit-aeo-gratuit/) (same scoring engine, browser version) and the [website pricing barometer](https://lescreavores.fr/prix-creation-site-internet/) (open dataset, CC-BY).

---

# creavores-aeo-mcp (Français)

Un serveur MCP (Model Context Protocol) qui audite n'importe quelle URL pour l'**AEO (Answer Engine Optimization)** et la préparation aux moteurs de recherche IA — un outil de diagnostic concret, pas un gadget. Il vérifie exactement ce que regardent ChatGPT, Perplexity, les AI Overviews de Google et les agents de navigation autonomes : une réponse directe citable, des données structurées JSON-LD valides, la conformité du fichier `llms.txt`, les signaux de confiance E-E-A-T, et la capacité des robots/agents IA à lire et naviguer réellement la page.

Développé par [Les Créavores](https://lescreavores.fr), une agence web et SEO/AEO. La logique de scoring est compatible avec le package public [`@macalc/aeo-score`](https://www.npmjs.com/package/@macalc/aeo-score) et l'outil gratuit d'[audit AEO en ligne](https://lescreavores.fr/outils/audit-aeo-gratuit/) — les scores obtenus ici correspondent à ceux affichés là-bas.

## Installation

Aucune étape d'installation nécessaire — lancez-le directement avec `npx` :

```bash
npx creavores-aeo-mcp
```

### Claude Desktop

Ajoutez ceci à votre `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "creavores-aeo": {
      "command": "npx",
      "args": ["-y", "creavores-aeo-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add creavores-aeo -- npx -y creavores-aeo-mcp
```

Ou ajoutez-le dans le fichier `.mcp.json` à la racine de votre projet :

```json
{
  "mcpServers": {
    "creavores-aeo": {
      "command": "npx",
      "args": ["-y", "creavores-aeo-mcp"]
    }
  }
}
```

Aucune clé API, aucune configuration ni variable d'environnement requise. Le serveur récupère les pages directement avec un User-Agent identifiable (`creavores-aeo-mcp/1.0 (+https://lescreavores.fr)`), un délai d'attente de 15 secondes, et ne lève jamais d'exception non gérée : chaque outil renvoie un JSON propre (y compris `{ "error": "..." }` en cas d'échec), ce qui le rend sûr à appeler depuis n'importe quelle boucle d'agent.

## Les 8 outils

### 1. `audit_aeo`

Audit AEO complet : crawlabilité (30 pts) + structure du contenu pour l'extraction IA (35 pts) + confiance E-E-A-T (35 pts), plus vérification du `llms.txt` et de l'accès des robots IA. Renvoie un score sur 100, un verdict et des recommandations priorisées et actionnables.

```json
{ "url": "https://exemple.fr/tarifs" }
```

### 2. `check_direct_answer`

Détecte une réponse directe de 40 à 60 mots placée juste sous le H1 — le signal de citabilité le plus fort pour les moteurs IA.

```json
{ "url": "https://exemple.fr/tarifs" }
```

### 3. `extract_structured_data`

Extrait et valide chaque bloc JSON-LD : types trouvés, erreurs de parsing, erreurs courantes du schéma (par exemple `acceptedAnswer` ou `datePublished` manquants), et confirme que les données sont bien présentes côté serveur (et non injectées côté client via `useEffect`, que de nombreux robots IA n'exécutent jamais).

```json
{ "url": "https://exemple.fr/tarifs" }
```

### 4. `check_llms_txt`

Vérifie l'existence et la conformité à la spécification [llmstxt.org](https://llmstxt.org/) : titre H1, résumé en citation, sections `## Titre`, et liste de liens au format Markdown.

```json
{ "domain": "exemple.fr" }
```

### 5. `check_eeat_signals`

Signature/auteur, dates de publication et de mise à jour, citations de sources, liens vers une page À propos/Méthodologie, liens vers les mentions légales, schéma Organization.

```json
{ "url": "https://exemple.fr/blog/article" }
```

### 6. `check_agentic_readiness`

**Outil différenciant**, aligné sur la nouvelle catégorie d'audit Lighthouse « Agentic Browsing » : cette page est-elle lisible et navigable par un *agent* IA (pas seulement un robot d'indexation classique) ? Vérifie le `llms.txt`, l'accès des robots IA dans le `robots.txt`, la hiérarchie des titres, la couverture des attributs alt sur les images, les repères ARIA, la balise viewport et l'URL canonique.

```json
{ "url": "https://exemple.fr/application" }
```

### 7. `simulate_ai_citation`

Simule la façon dont un moteur IA extrairait un passage citable : analyse les paragraphes, les listes, les tableaux et les réponses de FAQ, note chacun selon son autonomie de sens (auto-suffisance), et renvoie le passage le plus susceptible d'être cité — avec une explication du pourquoi (ou du pourquoi pas).

```json
{ "url": "https://exemple.fr/blog/article" }
```

### 8. `compare_aeo`

Compare les scores AEO de 2 à 3 URL côte à côte — utile pour se comparer directement à un concurrent.

```json
{ "urls": ["https://exemple.fr", "https://concurrent.fr"] }
```

## À propos

Développé par [Les Créavores](https://lescreavores.fr), une agence web et SEO/AEO basée à Metz, en France, avec une activité au Luxembourg. Nous construisons les outils que nous utilisons nous-mêmes : découvrez l'[audit AEO gratuit](https://lescreavores.fr/outils/audit-aeo-gratuit/) (même moteur de scoring, version navigateur) et le [baromètre des prix de création de site internet](https://lescreavores.fr/prix-creation-site-internet/) (jeu de données ouvert, licence CC-BY).

Une question, une suggestion, une envie de faire auditer votre site par une équipe humaine plutôt qu'un score automatisé ? Écrivez-nous via [lescreavores.fr](https://lescreavores.fr).
