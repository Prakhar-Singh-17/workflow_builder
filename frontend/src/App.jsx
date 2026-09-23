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
    <div className="flex h-screen bg-slate-50">
      <div className="flex w-full max-w-md flex-col border-r border-slate-200 bg-white">
        <ChatPanel
          sessionId={sessionId}
          onUpdate={handleUpdate}
          onNewConversation={handleNewConversation}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
        <StateTable collected={collected} />
        <WorkflowView workflow={workflow} />
      </div>
    </div>
  );
}

export default App;
