import { auditAeoTool } from "./audit_aeo.js";
import { checkDirectAnswerTool } from "./check_direct_answer.js";
import { extractStructuredDataTool } from "./extract_structured_data.js";
import { checkLlmsTxtTool } from "./check_llms_txt.js";
import { checkEeatSignalsTool } from "./check_eeat_signals.js";
import { checkAgenticReadinessTool } from "./check_agentic_readiness.js";
import { simulateAiCitationTool } from "./simulate_ai_citation.js";
import { compareAeoTool } from "./compare_aeo.js";

export const tools = [
  auditAeoTool,
  checkDirectAnswerTool,
  extractStructuredDataTool,
  checkLlmsTxtTool,
  checkEeatSignalsTool,
  checkAgenticReadinessTool,
  simulateAiCitationTool,
  compareAeoTool,
];
