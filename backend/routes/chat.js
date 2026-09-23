import { Router } from "express";
import { createSession, getSession, resetSession } from "../store/sessions.js";
import { getCollectedSummary, getNextMissingField } from "../services/planner.js";
import { applyBaseSchema, mergeUpdates } from "../services/stateManager.js";
import { generatePlan } from "../services/planGenerator.js";
import { extract } from "../services/extractor.js";

const router = Router();

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

// Figures out the reply once we know the session's fields are up to date:
// ask about the pending ambiguity if there is one, otherwise ask about the
// next missing field, otherwise move to "confirming" and summarize.
// This mutates session.fields/lastAskedFieldId/phase — safe to do here
// because by the time this runs, every LLM call for the turn has already
// succeeded (see handleAwaitingGoal/handleCollecting below).
//
// Phase 5 replaces the plain field.question with an LLM-phrased one
// (questionWriter) and adds real handling for "confirming"/"done".
function decideNextStep(session) {
  if (session.pendingAmbiguity) {
    return session.pendingAmbiguity.question;
  }

  const { fieldId, fields } = getNextMissingField(session);
  session.fields = fields;

  if (fieldId) {
    session.lastAskedFieldId = fieldId;
    return session.fields[fieldId].question;
  }

  session.phase = "confirming";
  const summaryLines = getCollectedSummary(session)
    .filter((row) => row.status === "filled")
    .map((row) => `- ${row.label}: ${row.value}`)
    .join("\n");
  return `Here's what I've got so far:\n${summaryLines}\n\nDoes this all look right? (Confirming and building the workflow is coming in the next phase.)`;
}

// Merges a freshly (re)generated plan into the session without ever
// discarding an answer the user already gave. Fields that already exist on
// the session keep their existing value/status; only brand-new field ids
// get the fresh "missing" placeholder from applyBaseSchema.
function mergePlanIntoSession(session, state) {
  const fields = {};
  for (const id of state.fieldOrder) {
    fields[id] = session.fields[id] ?? state.fields[id];
  }
  session.workflowType = state.workflowType;
  session.components = state.components;
  session.fieldOrder = state.fieldOrder;
  session.fields = fields;
}

// First message of the conversation: generate the checklist, then extract
// whatever the goal message already answered (it often does).
async function handleAwaitingGoal(session, message) {
  const plan = await generatePlan(message);
  const state = applyBaseSchema(plan);

  // The extractor needs a checklist to extract against, but nothing has
  // been committed to the session yet — use the freshly built state.
  const extraction = await extract(state, null, message);
  const { fields, rejectedUpdates } = mergeUpdates(state, extraction.updates, message);

  // Every LLM call succeeded — safe to commit to the session now.
  session.goal = message;
  session.workflowType = state.workflowType;
  session.components = state.components;
  session.fieldOrder = state.fieldOrder;
  session.fields = fields;
  session.phase = "collecting";
  session.rejectedUpdates.push(...rejectedUpdates);
  session.pendingAmbiguity = extraction.ambiguities[0] || null;

  return decideNextStep(session);
}

// Every subsequent message while still collecting fields.
async function handleCollecting(session, message) {
  // Give the extractor context on what's being answered: the pending
  // ambiguity's field if one is open, otherwise whatever was last asked.
  const contextFieldId = session.pendingAmbiguity
    ? session.pendingAmbiguity.fieldId
    : session.lastAskedFieldId;

  const extraction = await extract(session, contextFieldId, message);

  if (extraction.offTopic) {
    const question = session.pendingAmbiguity
      ? session.pendingAmbiguity.question
      : session.lastAskedFieldId
      ? session.fields[session.lastAskedFieldId].question
      : "What would you like to automate?";
    return `Let's stay focused on setting up your workflow. ${question}`;
  }

  const { fields, rejectedUpdates } = mergeUpdates(session, extraction.updates, message);

  // Expand the plan first (if needed) — do this before touching session
  // state, so a failed LLM call here doesn't leave things half-updated.
  let expandedState = null;
  if (extraction.introducesNewScope) {
    const expandedPlan = await generatePlan(message, session);
    expandedState = applyBaseSchema(expandedPlan);
  }

  // Everything succeeded — commit.
  session.fields = fields;
  session.rejectedUpdates.push(...rejectedUpdates);

  if (expandedState) {
    mergePlanIntoSession(session, expandedState);
  }

  if (session.pendingAmbiguity && session.fields[session.pendingAmbiguity.fieldId]?.status === "filled") {
    session.pendingAmbiguity = null;
  }
  if (extraction.ambiguities.length > 0) {
    session.pendingAmbiguity = extraction.ambiguities[0];
  }

  return decideNextStep(session);
}

// POST /api/chat — the main turn loop.
router.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message are required." });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  session.messages.push({ role: "user", text: message });

  let reply;
  try {
    if (session.phase === "awaiting_goal") {
      reply = await handleAwaitingGoal(session, message);
    } else if (session.phase === "collecting") {
      reply = await handleCollecting(session, message);
    } else {
      // "confirming" / "done" — real handling lands in Phase 5.
      reply = "Got it — confirming and generating the workflow is coming in the next phase.";
    }
  } catch (err) {
    console.error(`[chat] turn failed: ${err.message}`);
    reply = "Sorry, could you rephrase that?";
  }

  session.messages.push({ role: "assistant", text: reply });

  res.json({
    reply,
    phase: session.phase,
    collected: getCollectedSummary(session),
    workflow: session.workflow,
  });
});

export default router;
