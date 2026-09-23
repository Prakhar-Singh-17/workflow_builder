import { callJSON } from "./llm.js";
import { buildPlanPrompt } from "../prompts/plan.js";

const VALID_KINDS = new Set(["trigger", "condition", "action"]);
const VALID_TYPES = new Set(["text", "boolean", "choice"]);

// Fails loudly on a malformed plan rather than letting a bad shape flow into
// stateManager.applyBaseSchema() and corrupt session state further downstream.
function validatePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Plan response is not an object.");
  }
  if (typeof plan.workflowType !== "string" || !plan.workflowType) {
    throw new Error("Plan is missing a workflowType.");
  }
  if (!Array.isArray(plan.components) || plan.components.length === 0) {
    throw new Error("Plan is missing components.");
  }
  if (!Array.isArray(plan.fields) || plan.fields.length === 0) {
    throw new Error("Plan is missing fields.");
  }

  const componentIds = new Set();
  for (const c of plan.components) {
    if (!c.id || !VALID_KINDS.has(c.kind) || !c.label) {
      throw new Error(`Invalid component: ${JSON.stringify(c)}`);
    }
    componentIds.add(c.id);
  }

  for (const f of plan.fields) {
    if (!f.id || !f.componentId || !f.label || !f.question || !VALID_TYPES.has(f.type)) {
      throw new Error(`Invalid field: ${JSON.stringify(f)}`);
    }
    if (!componentIds.has(f.componentId)) {
      throw new Error(`Field "${f.id}" references unknown componentId "${f.componentId}".`);
    }
  }

  return plan;
}

// goal: the user's natural-language request (or the message that introduced
// new scope, in expand mode).
// existingState: pass the current session state to expand an existing plan
// instead of generating a fresh one; omit for a brand-new plan.
export async function generatePlan(goal, existingState = null) {
  const prompt = buildPlanPrompt(goal, existingState);
  const promptName = existingState ? "plan.expand" : "plan.generate";
  const plan = await callJSON(promptName, prompt);
  return validatePlan(plan);
}
