// Builds the prompt for extractor.js. The extractor's only job is to read
// one user message and report what was explicitly said — it never decides
// what to ask next or whether the conversation is done (that's planner.js).

function fieldSummaryForPrompt(state) {
  return state.fieldOrder.map((id) => {
    const f = state.fields[id];
    return {
      id,
      label: f.label,
      type: f.type,
      options: f.options,
      currentValue: f.value,
      status: f.status,
    };
  });
}

export function buildExtractPrompt(state, lastAskedFieldId, userMessage) {
  const checklist = fieldSummaryForPrompt(state);
  const lastAskedField = lastAskedFieldId ? state.fields[lastAskedFieldId] : null;

  return `
You are extracting information from a user's message while they configure an automation workflow (like n8n or Zapier). You are NOT deciding what to ask next or whether setup is complete — only reporting what this one message explicitly says.

Workflow being configured: ${state.workflowType || "(not yet determined)"}

Checklist (every field the workflow needs, with its current status):
${JSON.stringify(checklist, null, 2)}

${
  lastAskedField
    ? `You just asked the user: "${lastAskedField.question}" (field id: "${lastAskedFieldId}")`
    : "This is the user's first message about this workflow — no question has been asked yet."
}

The user's message is: "${userMessage}"

Rules:
- Extract a value ONLY if the user explicitly stated it in this message. Never infer, default, or guess.
- For every update, "evidence" must be copied word-for-word from the user's message above. If you can't point to the exact words, do not include that update at all — leave the field alone.
- A vague answer (e.g. "notify the team" when a specific channel/person is needed) is NOT a value. Instead add an ambiguity for that field, with a clarifying question and, if it helps, suggested options.
- "I don't know" or "you decide" is NOT a value either — add an ambiguity with suggested options so the user has to pick explicitly.
- The user may answer several fields in one message — extract all of them.
- If the user is correcting an earlier answer (e.g. "actually use Outlook instead"), extract the new value for that field; it will overwrite the old one.
- If the message introduces a whole new part of the automation that the checklist above doesn't cover (e.g. "also deploy to AWS" with no deployment field yet), set introducesNewScope to true.
- If the message has nothing to do with configuring this workflow (small talk, an unrelated question, etc.), set offTopic to true and leave updates/ambiguities empty.

Respond with ONLY this JSON shape, no commentary, no markdown fences:
{
  "updates": { "fieldId": { "value": "...", "evidence": "exact words copied from the message" } },
  "ambiguities": [{ "fieldId": "...", "question": "...", "options": ["..."] }],
  "introducesNewScope": false,
  "offTopic": false
}
`.trim();
}
