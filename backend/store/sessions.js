import { v4 as uuidv4 } from "uuid";

// In-memory session store. Keyed by sessionId -> session object.
// Swapping this for a real database later just means changing the
// functions below; nothing outside this file should touch `sessions` directly.
const sessions = new Map();

// Shape of a brand-new session, matching the data model in the project plan.
// Most fields stay empty until Phase 2+ fill them in (plan generation,
// field extraction, etc.) — Phase 1 only needs the session to exist and
// be readable/resettable.
function freshSession(id) {
  return {
    id,
    phase: "awaiting_goal",
    goal: null,
    workflowType: null,
    components: [],
    fields: {},
    fieldOrder: [],
    pendingAmbiguity: null,
    lastAskedFieldId: null,
    messages: [],
    workflow: null,
    rejectedUpdates: [],
  };
}

export function createSession() {
  const id = uuidv4();
  const session = freshSession(id);
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function resetSession(id) {
  if (!sessions.has(id)) return null;
  const session = freshSession(id);
  sessions.set(id, session);
  return session;
}
