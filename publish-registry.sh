#!/usr/bin/env bash
# Publie creavores-aeo-mcp 1.0.2 sur npm puis l'inscrit au registre MCP officiel.
# Préalable : `npm login` (compte macalc) dans ce terminal. Lancer : bash publish-registry.sh
set -euo pipefail
cd "$(dirname "$0")"
PUB=/c/Users/treso/Downloads/realdentalcosts-mcp/mcp-publisher.exe

npm whoami
node test/smoke.mjs | tail -2
npm publish --access public
# connexion GitHub par code d'appareil : ouvrir l'URL affichée et saisir le code
"$PUB" login github
"$PUB" publish
python - <<'PY'
import json, urllib.request
u = "https://registry.modelcontextprotocol.io/v0/servers?search=creavores"
d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60))
print("registre :", [(x.get("server", x).get("name"), x.get("server", x).get("version")) for x in d.get("servers", [])])
PY
