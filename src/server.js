import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

const toolsByName = new Map(tools.map((t) => [t.name, t]));

export function createServer() {
  const server = new Server(
    { name: "creavores-aeo-mcp", version: "1.0.2" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolsByName.get(name);

    if (!tool) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args || {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: Boolean(result && result.error),
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unhandled error in ${name}: ${err && err.message ? err.message : String(err)}` }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

export async function runStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is reserved for the JSON-RPC stream.
  console.error("creavores-aeo-mcp: MCP server running on stdio");
}
