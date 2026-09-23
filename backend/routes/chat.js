import { Router } from "express";
import { createSession, getSession, resetSession } from "../store/sessions.js";
import { getCollectedSummary, getNextMissingField } from "../services/planner.js";
import { applyBaseSchema, mergeUpdates } from "../services/stateManager.js";
import { generatePlan } from "../services/planGenerator.js";
import { extract } from "../services/extractor.js";
import { writeQuestion } from "../services/questionWriter.js";
import { buildWorkflow } from "../services/builder.js";

const router = Router();

// A simple, deterministic check for "the user said yes" — kept in code
// rather than left to the LLM, since confirming/not-confirming is exactly
// the kind of binary decision the planner (not the extractor) should make.
const AFFIRMATIVE_PATTERN =
  /\b(yes|yep|yeah|yup|correct|confirm(ed)?|looks good|sounds good|go ahead|build it|that'?s right|proceed|do it|perfect|great)\b/i;

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

// Figures out the reply once the session's fields are up to date: ask about
// the pending ambiguity if there is one, otherwise ask about the next
// missing field (phrased naturally by questionWriter), otherwise move to
// "confirming" and summarize. This mutates session.fields/lastAskedFieldId/
// phase — safe to do here because by the time this runs, every LLM call for
// the turn has already succeeded (see the handle* functions below).
async function decideNextStep(session) {
  if (session.pendingAmbiguity) {
    return session.pendingAmbiguity.question;
  }

  const { fieldId, fields } = getNextMissingField(session);
  session.fields = fields;

  if (fieldId) {
    session.lastAskedFieldId = fieldId;
    const recentMessages = session.messages.slice(-6);
    const collectedValues = Object.fromEntries(
      getCollectedSummary(session)
        .filter((row) => row.status === "filled")
        .map((row) => [row.label, row.value])
    );
    return writeQuestion(session.fields[fieldId], recentMessages, collectedValues);
  }

  session.phase = "confirming";
  const summaryLines = getCollectedSummary(session)
    .filter((row) => row.status === "filled")
    .map((row) => `- ${row.label}: ${row.value}`)
    .join("\n");
  return `Here's what I've got so far:\n${summaryLines}\n\nDoes this all look right? Say "yes" to build it, or tell me what to change.`;
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

// How many of the extractor's proposed updates actually passed the evidence
// check and got applied — used to tell "the user changed something" apart
// from "nothing about this message updated the checklist".
function countAcceptedUpdates(extraction, rejectedUpdates) {
  return Object.keys(extraction.updates || {}).length - rejectedUpdates.length;
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

// The user has been shown the collected summary and is expected to either
// confirm it, correct something, or both in the same message
// ("yes, but use Outlook instead"). A correction always wins: it re-opens
// collection so planner.getNextMissingField can re-check whether anything
// is now missing (e.g. a corrected boolean unlocking a conditional field)
// before we're willing to build anything.
async function handleConfirming(session, message) {
  const extraction = await extract(session, null, message);
  const { fields, rejectedUpdates } = mergeUpdates(session, extraction.updates, message);
  const acceptedUpdateCount = countAcceptedUpdates(extraction, rejectedUpdates);
  const newAmbiguity = extraction.ambiguities[0] || null;

  // Everything succeeded — commit.
  session.fields = fields;
  session.rejectedUpdates.push(...rejectedUpdates);

  // A correction, or even just a vague attempt at one ("actually notify the
  // team instead"), re-opens collection so it gets resolved properly rather
  // than silently dropped while we wait for a plain "yes".
  if (acceptedUpdateCount > 0 || newAmbiguity) {
    session.pendingAmbiguity = newAmbiguity;
    session.phase = "collecting";
    return decideNextStep(session);
  }

  if (AFFIRMATIVE_PATTERN.test(message) && !extraction.offTopic) {
    session.workflow = buildWorkflow(session);
    session.phase = "done";
    return "Your workflow is ready — see the diagram and JSON on the right. Ask for any changes, or start a new one.";
  }

  // Neither a correction nor a clear "yes" — re-show the summary rather
  // than guessing what the user meant.
  return decideNextStep(session);
}

// The workflow has already been built. A further message either asks for a
// change (re-opens collection, and the workflow is rebuilt once
// re-confirmed) or is just conversation, which gets a plain reply.
async function handleDone(session, message) {
  const extraction = await extract(session, null, message);
  const { fields, rejectedUpdates } = mergeUpdates(session, extraction.updates, message);
  const acceptedUpdateCount = countAcceptedUpdates(extraction, rejectedUpdates);
  const newAmbiguity = extraction.ambiguities[0] || null;

  let expandedState = null;
  if (extraction.introducesNewScope) {
    const expandedPlan = await generatePlan(message, session);
    expandedState = applyBaseSchema(expandedPlan);
  }

  if (acceptedUpdateCount === 0 && !expandedState && !newAmbiguity) {
    // Still log any rejected (hallucinated) updates even though nothing
    // about the workflow itself is changing this turn.
    session.rejectedUpdates.push(...rejectedUpdates);
    return 'Let me know what you\'d like to change, or start a "New conversation" to build a different workflow.';
  }

  session.fields = fields;
  session.rejectedUpdates.push(...rejectedUpdates);
  session.pendingAmbiguity = newAmbiguity;
  if (expandedState) mergePlanIntoSession(session, expandedState);
  session.workflow = null; // stale until the user re-confirms
  session.phase = "collecting";

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
    } else if (session.phase === "confirming") {
      reply = await handleConfirming(session, message);
    } else {
      reply = await handleDone(session, message);
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
