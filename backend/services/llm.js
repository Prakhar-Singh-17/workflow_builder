// Thin wrapper around the Gemini SDK. Every other service that needs the
// LLM goes through callJSON() so retry/parsing/logging behavior lives in
// exactly one place.

import { GoogleGenAI } from "@google/genai";

// Read lazily (not cached at import time): index.js loads .env from the
// project root via dotenv.config() *after* its imports resolve, and this
// module is one of those imports, so process.env.GEMINI_API_KEY would still
// be undefined if it were captured at the top of this file.
let client = null;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env (project root) and add your key."
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

// Some models wrap JSON in a ```json ... ``` fence even when JSON mode is
// requested. Strip that off before parsing.
function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

async function requestJSON(promptName, prompt) {
  const start = Date.now();
  const response = await getClient().models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const latencyMs = Date.now() - start;
  console.log(`[llm] ${promptName} (${latencyMs}ms)`);
  return JSON.parse(stripCodeFences(response.text ?? ""));
}

// Calls Gemini in JSON mode and parses the result. LLMs occasionally return
// malformed JSON, so this retries once before giving up. `promptName` is
// just a label for the console log (e.g. "plan.generate", "extract") — it
// has no effect on the request.
export async function callJSON(promptName, prompt) {
  try {
    return await requestJSON(promptName, prompt);
  } catch (err) {
    console.log(`[llm] ${promptName} failed once (${err.message}), retrying...`);
    try {
      return await requestJSON(promptName, prompt);
    } catch (retryErr) {
      throw new Error(`LLM call "${promptName}" failed after retry: ${retryErr.message}`);
    }
  }
}
