import { callJSON } from "./llm.js";
import { buildQuestionPrompt } from "../prompts/question.js";

// Phrases field.question more naturally for the conversation so far. Falls
// back to the field's own plain question on any failure (bad JSON, network
// error, empty response) — asking a slightly less natural question beats
// breaking the turn loop over a wording problem.
export async function writeQuestion(field, recentMessages, collectedValues) {
  try {
    const prompt = buildQuestionPrompt(field, recentMessages, collectedValues);
    const result = await callJSON("question", prompt);
    if (result && typeof result.question === "string" && result.question.trim()) {
      return result.question.trim();
    }
    return field.question;
  } catch (err) {
    console.log(`[questionWriter] falling back to field.question: ${err.message}`);
    return field.question;
  }
}
