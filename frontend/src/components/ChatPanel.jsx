import { useState } from "react";
import { createSession, sendMessage } from "../api";

// Owns the message list and the actual API calls. Reports phase/collected/
// workflow updates up to App via onUpdate, since those are shared with
// StateTable/WorkflowView (Phase 7) — this component only cares about chat.
function ChatPanel({ sessionId, onUpdate, onNewConversation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const data = await sendMessage(sessionId, text);
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      onUpdate({ phase: data.phase, collected: data.collected, workflow: data.workflow });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewConversation() {
    setMessages([]);
    setInput("");
    setError(null);
    try {
      const data = await createSession();
      onNewConversation(data.sessionId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-base text-white">
            ⚡
          </span>
          <h1 className="font-semibold text-stone-800">Workflow Builder</h1>
        </div>
        <button
          type="button"
          onClick={handleNewConversation}
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          New conversation
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-3xl">💬</span>
            <p className="text-sm text-stone-400">
              Describe what you'd like to automate to get started — e.g. "notify finance when an
              invoice arrives".
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                m.role === "user" ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="animate-pulse rounded-2xl bg-stone-100 px-3.5 py-2 text-sm text-stone-400">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-stone-200 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your automation..."
          disabled={!sessionId || isLoading}
          className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:bg-stone-50"
        />
        <button
          type="submit"
          disabled={!sessionId || isLoading || !input.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
