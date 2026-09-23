// Tests callJSON's retry/parse behavior against a mocked Gemini SDK — no
// real network calls. This is what covers test scenario 11 ("invalid LLM
// JSON is simulated in a test and handled gracefully") from the project plan.
import { jest } from "@jest/globals";

const mockGenerateContent = jest.fn();

jest.unstable_mockModule("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const { callJSON } = await import("../services/llm.js");

beforeEach(() => {
  mockGenerateContent.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "test-model";
});

test("returns parsed JSON on a clean first response", async () => {
  mockGenerateContent.mockResolvedValue({ text: '{"ok":true}' });
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("strips a markdown code fence before parsing", async () => {
  mockGenerateContent.mockResolvedValue({ text: '```json\n{"ok":true}\n```' });
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
});

test("retries once after malformed JSON, then succeeds", async () => {
  mockGenerateContent
    .mockResolvedValueOnce({ text: "this is not json" })
    .mockResolvedValueOnce({ text: '{"ok":true}' });
  const result = await callJSON("test-prompt", "prompt");
  expect(result).toEqual({ ok: true });
  expect(mockGenerateContent).toHaveBeenCalledTimes(2);
});

test("throws a clear error if both the call and the retry return malformed JSON", async () => {
  mockGenerateContent.mockResolvedValue({ text: "still not json" });
  await expect(callJSON("test-prompt", "prompt")).rejects.toThrow(
    /test-prompt.*failed after retry/
  );
  expect(mockGenerateContent).toHaveBeenCalledTimes(2);
});

test("throws a clear error if both the call and the retry reject (network error)", async () => {
  mockGenerateContent.mockRejectedValue(new Error("network down"));
  await expect(callJSON("test-prompt", "prompt")).rejects.toThrow(
    /test-prompt.*failed after retry/
  );
  expect(mockGenerateContent).toHaveBeenCalledTimes(2);
});

test("times out a stalled request instead of hanging forever", async () => {
  jest.useFakeTimers();
  mockGenerateContent.mockReturnValue(new Promise(() => {})); // never resolves

  const result = callJSON("test-prompt", "prompt");
  const assertion = expect(result).rejects.toThrow(/test-prompt.*failed after retry/);

  await jest.advanceTimersByTimeAsync(90000); // first attempt times out
  await jest.advanceTimersByTimeAsync(90000); // retry times out too

  await assertion;
  jest.useRealTimers();
});
