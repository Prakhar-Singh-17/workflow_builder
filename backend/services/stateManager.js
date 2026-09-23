// PURE functions only: no LLM calls, no I/O, no randomness. Given the same
// inputs these always return the same outputs, which is what makes them
// unit-testable without a network connection.

import {
  BASE_TRIGGER_COMPONENT,
  BASE_ACTION_COMPONENT,
  baseTriggerFields,
  ADDITIONAL_PREFERENCES_FIELD,
} from "../config/baseSchema.js";

// Turns a plan-generator-shaped plan ({ workflowType, components: [...],
// fields: [...] }) into the session-ready shape: fields keyed by id (each
// with value/status added) plus the order to ask them in. Also fills in
// whatever the base schema requires that the plan is missing (see
// config/baseSchema.js) — the LLM can add to this, but never remove it.
export function applyBaseSchema(plan) {
  const components = [...plan.components];

  let trigger = components.find((c) => c.kind === "trigger");
  if (!trigger) {
    trigger = { ...BASE_TRIGGER_COMPONENT };
    components.unshift(trigger);
  }

  if (!components.some((c) => c.kind === "action")) {
    components.push({ ...BASE_ACTION_COMPONENT });
  }

  const rawFields = [...plan.fields];
  for (const requiredField of baseTriggerFields(trigger.id)) {
    if (!rawFields.some((f) => f.id === requiredField.id)) {
      rawFields.push(requiredField);
    }
  }
  if (!rawFields.some((f) => f.id === "additionalPreferences")) {
    rawFields.push({ ...ADDITIONAL_PREFERENCES_FIELD });
  }

  // additionalPreferences is always asked last, regardless of where the
  // plan (or the base schema fallback above) put it.
  const orderedFields = [
    ...rawFields.filter((f) => f.id !== "additionalPreferences"),
    rawFields.find((f) => f.id === "additionalPreferences"),
  ];

  const fields = {};
  const fieldOrder = [];
  for (const f of orderedFields) {
    fieldOrder.push(f.id);
    fields[f.id] = {
      componentId: f.componentId ?? null,
      label: f.label,
      question: f.question,
      type: f.type,
      options: f.options ?? null,
      requiredIf: f.requiredIf ?? null,
      value: null,
      status: "missing",
    };
  }

  return { workflowType: plan.workflowType, components, fields, fieldOrder };
}

// Normalizes a string for the evidence comparison: lowercase, collapse
// whitespace, strip surrounding punctuation. Two strings that only differ by
// case, spacing, or a trailing "." should still be considered a match.
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[.,!?;:'"]+|[.,!?;:'"]+$/g, "");
}

// This is the code-side guarantee behind "never assume": the extractor
// (Phase 4) claims a value came from the user, but we only accept that claim
// if the exact words it points to actually appear in what the user typed.
export function hasValidEvidence(evidence, userMessage) {
  const normalizedEvidence = normalize(evidence);
  if (!normalizedEvidence) return false;
  const normalizedMessage = normalize(userMessage);
  return normalizedMessage.includes(normalizedEvidence);
}

// Applies extractor updates ({ fieldId: { value, evidence } }) to a session's
// fields. Returns a new fields object plus the list of updates that were
// rejected for lacking evidence, so the caller can log them and keep asking
// about those fields. Field ids that aren't part of the checklist are
// silently ignored — the extractor should never invent new fields.
export function mergeUpdates(state, updates, userMessage) {
  const fields = { ...state.fields };
  const rejectedUpdates = [];

  for (const [fieldId, update] of Object.entries(updates || {})) {
    if (!(fieldId in fields)) continue;

    const { value, evidence } = update || {};
    if (!hasValidEvidence(evidence, userMessage)) {
      rejectedUpdates.push({
        fieldId,
        value,
        evidence,
        reason: "evidence not found in user message",
      });
      console.log(
        `[stateManager] rejected update for "${fieldId}": evidence "${evidence}" not found in message`
      );
      continue;
    }

    fields[fieldId] = { ...fields[fieldId], value, status: "filled" };
  }

  return { fields, rejectedUpdates };
}
