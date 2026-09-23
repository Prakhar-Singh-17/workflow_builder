// The minimum shape every generated workflow plan must satisfy, no matter
// what domain the user's goal is in. planGenerator.js (Phase 3) proposes a
// plan on top of this, but stateManager.applyBaseSchema() guarantees these
// pieces are always present — the LLM can add fields, it can never remove
// these.

export const BASE_TRIGGER_COMPONENT = {
  id: "trigger",
  kind: "trigger",
  label: "Trigger",
};

export const BASE_ACTION_COMPONENT = {
  id: "action",
  kind: "action",
  label: "Action",
};

// Every trigger component must be able to answer "what app" and "what event".
export function baseTriggerFields(triggerComponentId) {
  return [
    {
      id: "triggerApp",
      componentId: triggerComponentId,
      label: "Trigger Source",
      question: "What app or system should trigger this workflow?",
      type: "text",
      requiredIf: null,
    },
    {
      id: "triggerEvent",
      componentId: triggerComponentId,
      label: "Trigger Event",
      question: "What event on that app should start the workflow?",
      type: "text",
      requiredIf: null,
    },
  ];
}

// Always the last question asked, in every workflow, in every domain.
// "None" is a valid, explicit answer for this field.
export const ADDITIONAL_PREFERENCES_FIELD = {
  id: "additionalPreferences",
  componentId: null,
  label: "Additional Preferences",
  question: "Any additional preferences before we build this?",
  type: "text",
  requiredIf: null,
};
