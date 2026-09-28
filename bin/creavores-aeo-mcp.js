#!/usr/bin/env node
import { runStdioServer } from "../src/server.js";

runStdioServer().catch((err) => {
  console.error("creavores-aeo-mcp: fatal error", err);
  process.exit(1);
});
