import { useEffect, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import StateTable from "./components/StateTable";
import WorkflowView from "./components/WorkflowView";
import { createSession } from "./api";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [collected, setCollected] = useState([]);
  const [workflow, setWorkflow] = useState(null);

  // Start a session as soon as the app loads.
  useEffect(() => {
    createSession().then((data) => setSessionId(data.sessionId));
  }, []);

  function handleUpdate({ collected, workflow }) {
    setCollected(collected);
    setWorkflow(workflow);
  }

  function handleNewConversation(newSessionId) {
    setSessionId(newSessionId);
    setCollected([]);
    setWorkflow(null);
  }

  return (
    <div className="flex h-screen bg-stone-50">
      <div className="min-w-0 flex-1 overflow-y-auto border-r border-stone-200 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <StateTable collected={collected} />
          <WorkflowView workflow={workflow} />
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col bg-white shadow-[-4px_0_16px_-8px_rgba(0,0,0,0.08)]">
        <ChatPanel
          sessionId={sessionId}
          onUpdate={handleUpdate}
          onNewConversation={handleNewConversation}
        />
      </div>
    </div>
  );
}

export default App;
