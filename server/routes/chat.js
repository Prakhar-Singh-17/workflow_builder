import { Router } from "express";
import { createSession, getSession, resetSession } from "../store/sessions.js";

const router = Router();

// Turns a session's fields into the flat list the frontend's
// "Collected Information" table displays. Real logic (skipping fields
// that aren't required yet, etc.) lands in Phase 2's planner.js — for now
// there are no fields to collect yet, so this is always empty.
function getCollectedSummary(session) {
  return Object.values(session.fields).map((field) => ({
    label: field.label,
    value: field.value,
    status: field.status,
  }));
}

// POST /api/session — start a new conversation.
router.post("/session", (req, res) => {
  const session = createSession();
  res.json({ sessionId: session.id });
});

// GET /api/session/:id — full session, for debugging/demo.
router.get("/session/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }
  res.json(session);
});

// POST /api/session/:id/reset — start the same session over from scratch.
router.post("/session/:id/reset", (req, res) => {
  const session = resetSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }
  res.json({ sessionId: session.id, phase: session.phase });
});

// POST /api/chat — the main turn loop. This is a stub for Phase 1: it just
// echoes the message back. Phase 3+ replaces the reply logic with real
// plan generation, extraction, and question asking.
router.post("/chat", (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message are required." });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  session.messages.push({ role: "user", text: message });

  const reply = `You said: "${message}"`;
  session.messages.push({ role: "assistant", text: reply });

  res.json({
    reply,
    phase: session.phase,
    collected: getCollectedSummary(session),
    workflow: session.workflow,
  });
});

export default router;
