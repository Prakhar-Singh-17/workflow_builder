// PURE functions only: given a session state, these decide what to ask next
// and whether collection is done. No LLM calls — this is the part of the
// system that is not allowed to "guess" its way to completion.

// A field with no requiredIf is always required. A field with a requiredIf
// is only required once the field it depends on has the matching value.
export function isFieldRequired(field, state) {
  if (!field.requiredIf) return true;
  const dependency = state.fields[field.requiredIf.field];
  if (!dependency) return true; // can't evaluate it — ask rather than assume
  return dependency.value === field.requiredIf.equals;
}

// Walks fieldOrder and returns the next field that still needs an answer,
// along with an updated fields map where:
//   - fields that are no longer required (and not yet answered) are marked
//     "skipped"
//   - a field that was "skipped" but has become required again (e.g. the
//     user corrected an earlier answer) is reset to "missing" so it gets
//     asked
// Fields the user already answered ("filled") are never touched, even if
// they'd no longer be required — an explicit answer is never discarded.
// Returns { fieldId: null, fields } once nothing is left to ask.
export function getNextMissingField(state) {
  const fields = { ...state.fields };

  for (const fieldId of state.fieldOrder) {
    const field = fields[fieldId];
    if (field.status === "filled") continue;

    const required = isFieldRequired(field, { ...state, fields });

    if (!required) {
      if (field.status !== "skipped") {
        fields[fieldId] = { ...field, status: "skipped" };
      }
      continue;
    }

    if (field.status !== "missing") {
      fields[fieldId] = { ...field, status: "missing" };
    }
    return { fieldId, fields };
  }

  return { fieldId: null, fields };
}

// Collection is complete when there's no pending ambiguity to resolve and
// every required field has a value.
export function isComplete(state) {
  if (state.pendingAmbiguity) return false;
  return getNextMissingField(state).fieldId === null;
}

// Rows for the "Collected Information" table: every field in order, in
// whatever state it's currently in.
export function getCollectedSummary(state) {
  return state.fieldOrder.map((fieldId) => {
    const field = state.fields[fieldId];
    return { label: field.label, value: field.value, status: field.status };
  });
}
