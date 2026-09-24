// Thin wrapper around Groq's API (OpenAI-compatible REST — no SDK needed,
// just fetch). Every other service that needs the LLM goes through
// callJSON() so retry/parsing/timeout/logging behavior lives in exactly one
// place; swapping providers again later should only ever mean rewriting
// this file.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq's whole selling point is speed, so a stalled request here is a real
// anomaly, not just slow inference — this can be much tighter than a
// typical LLM timeout while still leaving real margin.
const REQUEST_TIMEOUT_MS = 30000;

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  // Clear the timer either way — otherwise a successful call still leaves a
  // dangling timeout pending for the rest of its duration.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// Some models wrap JSON in a ```json ... ``` fence even when JSON mode is
// requested. Strip that off before parsing.
function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

async function requestJSON(promptName, prompt) {
  // Read lazily (not cached at import time): index.js loads .env from the
  // project root via dotenv.config() *after* its imports resolve, and this
  // module is one of those imports, so process.env.GROQ_API_KEY would still
  // be undefined if it were captured at the top of this file.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Copy .env.example to .env (project root) and add your key."
    );
  }

  const start = Date.now();
  const response = await withTimeout(
    fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
    }),
    REQUEST_TIMEOUT_MS,
    promptName
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`got status: ${response.status} ${response.statusText}. ${body}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - start;
  console.log(`[llm] ${promptName} (${latencyMs}ms)`);

  const text = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(stripCodeFences(text));
}

// Calls the LLM in JSON mode and parses the result. LLMs occasionally
// return malformed JSON, so this retries once before giving up.
// `promptName` is just a label for the console log (e.g. "plan.generate",
// "extract") — it has no effect on the request.
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
