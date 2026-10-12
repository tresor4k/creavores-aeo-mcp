FROM node:22-alpine

WORKDIR /app

# No "prepare" script in package.json: dependencies can be installed before the sources are copied.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY bin ./bin
COPY src ./src
COPY README.md LICENSE server.json ./

USER node

ENV NODE_ENV=production

# Same entry point as the npm "bin" field (bin/creavores-aeo-mcp.js -> src/server.js), MCP over stdio.
ENTRYPOINT ["node", "bin/creavores-aeo-mcp.js"]
