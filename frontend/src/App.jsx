import { useEffect, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import { createSession } from "./api";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState("awaiting_goal");
  const [collected, setCollected] = useState([]);
  const [workflow, setWorkflow] = useState(null);

  // Start a session as soon as the app loads.
  useEffect(() => {
    createSession().then((data) => setSessionId(data.sessionId));
  }, []);

  function handleUpdate({ phase, collected, workflow }) {
    setPhase(phase);
    setCollected(collected);
    setWorkflow(workflow);
  }

  function handleNewConversation(newSessionId) {
    setSessionId(newSessionId);
    setPhase("awaiting_goal");
    setCollected([]);
    setWorkflow(null);
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="flex w-full max-w-md flex-col border-r border-slate-200 bg-white">
        <ChatPanel
          sessionId={sessionId}
          onUpdate={handleUpdate}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* StateTable + WorkflowView land here in Phase 7. */}
      <div className="flex-1 p-6">
        <p className="text-sm text-slate-400">
          Collected information and workflow view are coming in Phase 7. (phase: {phase}, fields
          collected: {collected.length}, workflow ready: {workflow ? "yes" : "no"})
        </p>
      </div>
    </div>
  );
}

export default App;
