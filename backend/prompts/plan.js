// Builds the prompt for planGenerator.js. Kept as a plain string-building
// function (not a template engine) so it's easy to read top to bottom.

const RESPONSE_SHAPE = `{
  "workflowType": "short_snake_case_identifier",
  "components": [
    { "id": "camelCaseId", "kind": "trigger" | "condition" | "action", "label": "Short human-readable label" }
  ],
  "fields": [
    {
      "id": "camelCaseId",
      "componentId": "the component this field configures",
      "label": "Short label for a UI table",
      "question": "A natural question to ask the user",
      "type": "text" | "boolean" | "choice",
      "options": ["only for type choice"],
      "requiredIf": { "field": "otherFieldId", "equals": true } // or null if always required
    }
  ]
}`;

const RULES = `
Rules:
- Ask "whether" before "what": if a condition or filter might exist, add a boolean field for whether it applies BEFORE any field asking for its specific value. Make the specific-value field conditional on the boolean using "requiredIf".
- Use camelCase for every "id".
- Order fields logically: trigger fields first, then conditions and actions in the order they'd execute.
- Aim for 5 to 10 fields total. Do not over-ask — only include what's genuinely needed to configure this workflow.
- Every field needs componentId pointing at one of the components you listed.
- Respond with ONLY the JSON object below, no commentary, no markdown fences.`;

// Fresh plan for a brand-new goal.
function buildNewPlanPrompt(goal) {
  return `
You are helping design an automation workflow (like n8n or Zapier) from a natural-language request. You are only planning the workflow — listing what would need to be configured — not building or running anything.

The user's automation request is: "${goal}"

Think about what a professional automation engineer would need to know to configure this from scratch. List the components (trigger, conditions, actions) in execution order, and the fields (questions) needed to configure each one.
${RULES}

${RESPONSE_SHAPE}
`.trim();
}

// Expands an existing plan when the user introduces new scope mid-conversation
// (e.g. "also deploy to AWS"). Existing components/fields must be preserved.
function buildExpandPlanPrompt(goal, existingState) {
  const existingFieldIds = Object.keys(existingState.fields);
  return `
You are helping design an automation workflow (like n8n or Zapier). A plan is already in progress and the user just introduced new scope that the current plan doesn't cover.

Workflow type so far: ${existingState.workflowType}
Components so far: ${JSON.stringify(existingState.components)}
Field ids already on the checklist: ${JSON.stringify(existingFieldIds)}

The user's new message is: "${goal}"

Expand the plan to cover this new scope. You MUST keep every existing component and field id exactly as they are — do not remove, rename, or redefine them. Only ADD new components and new fields needed for the new scope. Return the FULL plan (existing components/fields plus your additions) in the shape below.
${RULES}

${RESPONSE_SHAPE}
`.trim();
}

export function buildPlanPrompt(goal, existingState = null) {
  return existingState
    ? buildExpandPlanPrompt(goal, existingState)
    : buildNewPlanPrompt(goal);
}
