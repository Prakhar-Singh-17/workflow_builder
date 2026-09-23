import { callJSON } from "./llm.js";
import { buildExtractPrompt } from "../prompts/extract.js";

// Defends against a malformed LLM response without throwing — an extractor
// hiccup shouldn't break the turn loop the way a bad plan should. Anything
// missing just falls back to "nothing extracted this turn".
function normalizeExtraction(result) {
  const updates =
    result && typeof result.updates === "object" && result.updates !== null
      ? result.updates
      : {};
  const ambiguities = Array.isArray(result?.ambiguities) ? result.ambiguities : [];

  return {
    updates,
    ambiguities,
    introducesNewScope: Boolean(result?.introducesNewScope),
    offTopic: Boolean(result?.offTopic),
  };
}

// state: the session (has .fields, .fieldOrder, .workflowType).
// lastAskedFieldId: the field the bot just asked about (or the pending
// ambiguity's field, if one is open) — gives the extractor context for
// short answers like "yes" or "Gmail". Pass null for a first message.
export async function extract(state, lastAskedFieldId, userMessage) {
  const prompt = buildExtractPrompt(state, lastAskedFieldId, userMessage);
  const result = await callJSON("extract", prompt);
  return normalizeExtraction(result);
}
