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
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h1 className="font-semibold text-slate-800">Workflow Builder</h1>
        <button
          type="button"
          onClick={handleNewConversation}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          New conversation
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Describe what you'd like to automate to get started — e.g. "notify finance when an
            invoice arrives".
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your automation..."
          disabled={!sessionId || isLoading}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!sessionId || isLoading || !input.trim()}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
