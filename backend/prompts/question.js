// Builds the prompt for questionWriter.js — phrasing one field's fallback
// question more naturally, given the conversation so far.

export function buildQuestionPrompt(field, recentMessages, collectedValues) {
  const conversation = recentMessages.length
    ? recentMessages.map((m) => `${m.role}: ${m.text}`).join("\n")
    : "(no messages yet)";

  return `
You are writing ONE short, friendly question while helping someone configure an automation workflow (like n8n or Zapier).

The field to ask about:
- Label: ${field.label}
- Plain version of the question: ${field.question}
- Type: ${field.type}
${field.options ? `- Options: ${field.options.join(", ")}` : ""}

What's already been collected:
${JSON.stringify(collectedValues, null, 2)}

Recent conversation:
${conversation}

Write ONE short, natural-sounding question that asks for exactly this field and nothing else. If it has options, mention them naturally. Keep it conversational, not robotic.

Respond with ONLY this JSON shape, no commentary, no markdown fences:
{ "question": "..." }
`.trim();
}
