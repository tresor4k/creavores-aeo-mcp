import { checkLlmsTxt } from "../lib/llmstxt.js";

export const checkLlmsTxtTool = {
  name: "check_llms_txt",
  description:
    "Checks whether a domain publishes an llms.txt file and whether it follows the llmstxt.org specification: H1 title, optional blockquote summary, '## Section' headings, and Markdown link list items ('- [Title](URL): notes'). Returns existence, a 0-100 compliance score, and the extracted links.",
  inputSchema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain or base URL, e.g. example.com or https://example.com" },
    },
    required: ["domain"],
  },
  async handler({ domain }) {
    return checkLlmsTxt(domain);
  },
};
