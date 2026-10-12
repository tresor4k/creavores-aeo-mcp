
## 1.1.0 — 2026-10-12

### Added
- Three data tools reading the Les Créavores open-data files live (no data bundled in the package):
  - `get_prix_site`: displayed website prices per `type|unit` (`reference-prix.json`), filters `type`, `unit`.
  - `get_marches_publics`: French public procurement aggregates (DECP, BOAMP) from `reference-prix.json`
    and `stats.json`, filter `buyer_type`.
  - `get_marronniers`: editorial calendar dates 2026-2027 (`marronniers-2026-2027.json`), filters
    `from`, `to`, `sector`, `limit`.
- Each data answer carries `source`, `licence`, `generated_at` and `citation`; an unreachable file
  returns `{ "error": "..." }`.

## 1.0.3 — 2026-09-28

### Added
- Public source repository: https://github.com/tresor4k/creavores-aeo-mcp (`repository` in
  `package.json` and `server.json`).

## 1.0.2 — 2026-09-20

### Added
- `mcpName` in `package.json` and a `server.json` manifest, required to list the server in the
  official MCP Registry under `io.github.tresor4k/creavores-aeo-mcp`.

### Fixed
- The server now reports its real version (it was still announcing `1.0.0`).

## 1.0.1 — 2026-07-13

### Fixed
- `llms.txt` detection no longer reports a soft 404 as an existing file. Many hosts
  answer a missing path with their homepage in HTTP 200; the check now also rejects
  HTML responses (by `Content-Type` and by sniffing the body), so a site without an
  `llms.txt` is correctly reported as `missing` instead of `exists: true`.
