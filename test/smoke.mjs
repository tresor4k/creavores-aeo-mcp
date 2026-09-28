// Smoke test: spawns the MCP server as a child process, speaks raw
// JSON-RPC over stdio (initialize -> tools/list -> tools/call x2),
// and asserts the shape of the responses. No test framework needed.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(__dirname, "..", "bin", "creavores-aeo-mcp.js");

function send(child, msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function createReader(child) {
  let buffer = "";
  const waiters = [];
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (waiters.length) waiters.shift()(msg);
    }
  });
  return {
    next(timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for a response")), timeoutMs);
        waiters.push((msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
      });
    },
  };
}

async function main() {
  console.log("Spawning MCP server:", binPath);
  const child = spawn(process.execPath, [binPath], { stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", (d) => process.stderr.write(`[server stderr] ${d}`));

  const reader = createReader(child);
  let failures = 0;

  // 1. initialize
  send(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "1.0.0" },
    },
  });
  const initResp = await reader.next();
  console.log("\n=== initialize response ===");
  console.log(JSON.stringify(initResp, null, 2));
  if (!initResp.result || !initResp.result.serverInfo) {
    console.error("FAIL: initialize did not return serverInfo");
    failures++;
  }

  send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

  // 2. tools/list
  send(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const listResp = await reader.next();
  const listedNames = (listResp.result?.tools || []).map((t) => t.name);
  console.log("\n=== tools/list ===");
  console.log("Tool count:", listedNames.length);
  console.log("Tools:", listedNames.join(", "));

  const expected = [
    "audit_aeo",
    "check_direct_answer",
    "extract_structured_data",
    "check_llms_txt",
    "check_eeat_signals",
    "check_agentic_readiness",
    "simulate_ai_citation",
    "compare_aeo",
  ];
  const missing = expected.filter((n) => !listedNames.includes(n));
  if (missing.length) {
    console.error("FAIL: missing tools:", missing);
    failures++;
  } else {
    console.log("PASS: all 8 expected tools are listed.");
  }

  // 3. tools/call audit_aeo on https://lescreavores.fr/
  send(child, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "audit_aeo", arguments: { url: "https://lescreavores.fr/" } },
  });
  const auditResp = await reader.next(30000);
  console.log("\n=== tools/call audit_aeo(https://lescreavores.fr/) ===");
  const auditText = auditResp.result?.content?.[0]?.text;
  console.log(auditText);
  if (!auditText) {
    console.error("FAIL: no content returned for audit_aeo");
    failures++;
  } else {
    const parsed = JSON.parse(auditText);
    if (typeof parsed.score !== "number" && !parsed.error) {
      console.error("FAIL: audit_aeo did not return a numeric score");
      failures++;
    } else if (parsed.error) {
      console.error("WARN: audit_aeo returned an error payload (network issue?):", parsed.error);
    } else {
      console.log(`PASS: audit_aeo returned score=${parsed.score}/100, verdict=${parsed.verdict}`);
    }
  }

  // 4. tools/call check_llms_txt on lescreavores.fr
  send(child, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "check_llms_txt", arguments: { domain: "https://lescreavores.fr" } },
  });
  const llmsResp = await reader.next(30000);
  console.log("\n=== tools/call check_llms_txt(https://lescreavores.fr) ===");
  const llmsText = llmsResp.result?.content?.[0]?.text;
  console.log(llmsText);
  if (!llmsText) {
    console.error("FAIL: no content returned for check_llms_txt");
    failures++;
  } else {
    const parsed = JSON.parse(llmsText);
    if (parsed.error) {
      console.error("WARN: check_llms_txt returned an error payload:", parsed.error);
    } else {
      console.log(`PASS: check_llms_txt returned exists=${parsed.exists}, score=${parsed.score}`);
    }
  }

  child.kill();

  console.log("\n=== SMOKE TEST SUMMARY ===");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  } else {
    console.log("All checks passed.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
