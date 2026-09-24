// Tests callJSON's retry/parse behavior against a mocked fetch — no real
// network calls. This is what covers test scenario 11 ("invalid LLM JSON is
// simulated in a test and handled gracefully") from the project plan.
import { jest } from "@jest/globals";

const { callJSON } = await import("../services/llm.js");

function groqResponse(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  process.env.GROQ_MODEL = "test-model";
  global.fetch = jest.fn();
});

test("returns parsed JSON on a clean first response", async () => {
  global.fetch.mockResolvedValue(groqResponse('{"ok":true}'));
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("strips a markdown code fence before parsing", async () => {
  global.fetch.mockResolvedValue(groqResponse('```json\n{"ok":true}\n```'));
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
});

test("retries once after malformed JSON, then succeeds", async () => {
  global.fetch
    .mockResolvedValueOnce(groqResponse("this is not json"))
    .mockResolvedValueOnce(groqResponse('{"ok":true}'));
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("throws a clear error if both the call and the retry return malformed JSON", async () => {
  global.fetch.mockResolvedValue(groqResponse("still not json"));
  await expect(callJSON("test-prompt", "prompt")).rejects.toThrow(
    /test-prompt.*failed after retry/
  );
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("throws a clear error on a non-2xx HTTP response (e.g. rate limited)", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    text: async () => "rate limit exceeded",
  });
  await expect(callJSON("test-prompt", "prompt")).rejects.toThrow(
    /test-prompt.*failed after retry/
  );
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("throws a clear error if both the call and the retry reject (network error)", async () => {
  global.fetch.mockRejectedValue(new Error("network down"));
  await expect(callJSON("test-prompt", "prompt")).rejects.toThrow(
    /test-prompt.*failed after retry/
  );
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("times out a stalled request instead of hanging forever", async () => {
  jest.useFakeTimers();
  global.fetch.mockReturnValue(new Promise(() => {})); // never resolves

  const result = callJSON("test-prompt", "prompt");
  const assertion = expect(result).rejects.toThrow(/test-prompt.*failed after retry/);

  await jest.advanceTimersByTimeAsync(30000); // first attempt times out
  await jest.advanceTimersByTimeAsync(30000); // retry times out too

  await assertion;
  jest.useRealTimers();
});
