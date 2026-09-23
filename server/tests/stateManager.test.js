import {
  applyBaseSchema,
  hasValidEvidence,
  mergeUpdates,
} from "../services/stateManager.js";
import { invoicePlan, cicdPlan } from "./fixtures/plans.js";

describe("applyBaseSchema", () => {
  test("keeps a plan's own trigger/action components as-is when already present", () => {
    const state = applyBaseSchema(invoicePlan);
    const triggers = state.components.filter((c) => c.kind === "trigger");
    const actions = state.components.filter((c) => c.kind === "action");
    expect(triggers).toHaveLength(1);
    expect(triggers[0].id).toBe("trigger"); // the plan's own trigger, not a synthesized one
    expect(actions).toHaveLength(1);
  });

  test("adds a trigger component and triggerApp/triggerEvent fields when the plan has none", () => {
    const bareplan = {
      workflowType: "custom_thing",
      components: [{ id: "action1", kind: "action", label: "Do the thing" }],
      fields: [],
    };

    const state = applyBaseSchema(bareplan);

    const trigger = state.components.find((c) => c.kind === "trigger");
    expect(trigger).toBeDefined();
    expect(state.fields.triggerApp).toBeDefined();
    expect(state.fields.triggerEvent).toBeDefined();
    expect(state.fields.triggerApp.status).toBe("missing");
    expect(state.fields.triggerApp.componentId).toBe(trigger.id);
  });

  test("adds an action component when the plan has none", () => {
    const bareplan = {
      workflowType: "custom_thing",
      components: [{ id: "trigger", kind: "trigger", label: "Some Trigger" }],
      fields: [],
    };

    const state = applyBaseSchema(bareplan);
    expect(state.components.some((c) => c.kind === "action")).toBe(true);
  });

  test("always appends additionalPreferences as the last field", () => {
    const invoiceState = applyBaseSchema(invoicePlan);
    const cicdState = applyBaseSchema(cicdPlan);

    expect(invoiceState.fieldOrder.at(-1)).toBe("additionalPreferences");
    expect(cicdState.fieldOrder.at(-1)).toBe("additionalPreferences");
    expect(invoiceState.fields.additionalPreferences.status).toBe("missing");
  });

  test("does not duplicate additionalPreferences if the plan already included it", () => {
    const planWithPrefs = {
      ...invoicePlan,
      fields: [
        ...invoicePlan.fields,
        {
          id: "additionalPreferences",
          componentId: null,
          label: "Anything else?",
          question: "Anything else?",
          type: "text",
          requiredIf: null,
        },
      ],
    };

    const state = applyBaseSchema(planWithPrefs);
    const occurrences = state.fieldOrder.filter(
      (id) => id === "additionalPreferences"
    );
    expect(occurrences).toHaveLength(1);
  });

  test("every field starts with value: null and status: missing", () => {
    const state = applyBaseSchema(cicdPlan);
    for (const fieldId of state.fieldOrder) {
      expect(state.fields[fieldId].value).toBeNull();
      expect(state.fields[fieldId].status).toBe("missing");
    }
  });
});

describe("hasValidEvidence", () => {
  test("accepts evidence that appears verbatim in the message", () => {
    expect(hasValidEvidence("Gmail", "We use Gmail for invoices")).toBe(true);
  });

  test("rejects evidence that was hallucinated (not in the message)", () => {
    expect(hasValidEvidence("Slack", "notify my team about it")).toBe(false);
  });

  test("rejects empty evidence", () => {
    expect(hasValidEvidence("", "notify my team")).toBe(false);
    expect(hasValidEvidence(undefined, "notify my team")).toBe(false);
  });

  test("accepts evidence that differs only by case and whitespace", () => {
    expect(hasValidEvidence("only above 10k", "Only   Above 10K, please")).toBe(
      true
    );
  });

  test("accepts a short direct answer like 'yes'", () => {
    expect(hasValidEvidence("yes", "yes")).toBe(true);
  });
});

describe("mergeUpdates", () => {
  test("accepts an update with valid evidence and marks the field filled", () => {
    const state = applyBaseSchema(invoicePlan);
    const { fields, rejectedUpdates } = mergeUpdates(
      state,
      { triggerApp: { value: "Gmail", evidence: "Gmail" } },
      "Use Gmail as the trigger"
    );

    expect(fields.triggerApp.value).toBe("Gmail");
    expect(fields.triggerApp.status).toBe("filled");
    expect(rejectedUpdates).toHaveLength(0);
  });

  test("rejects an update whose evidence is hallucinated", () => {
    const state = applyBaseSchema(invoicePlan);
    const { fields, rejectedUpdates } = mergeUpdates(
      state,
      { notifyChannel: { value: "Slack", evidence: "Slack" } },
      "notify my team about it"
    );

    expect(fields.notifyChannel.value).toBeNull();
    expect(fields.notifyChannel.status).toBe("missing");
    expect(rejectedUpdates).toHaveLength(1);
    expect(rejectedUpdates[0].fieldId).toBe("notifyChannel");
  });

  test("ignores updates for field ids that don't exist in the checklist", () => {
    const state = applyBaseSchema(invoicePlan);
    const { fields, rejectedUpdates } = mergeUpdates(
      state,
      { notARealField: { value: "x", evidence: "x" } },
      "x"
    );

    expect(fields.notARealField).toBeUndefined();
    expect(rejectedUpdates).toHaveLength(0);
  });

  test("fills multiple fields from a single message", () => {
    const state = applyBaseSchema(invoicePlan);
    const { fields } = mergeUpdates(
      state,
      {
        triggerApp: { value: "Gmail", evidence: "Gmail" },
        notifyChannel: { value: "Finance", evidence: "Finance label" },
      },
      "Gmail, Finance label, only above ₹10,000"
    );

    expect(fields.triggerApp.status).toBe("filled");
    expect(fields.notifyChannel.status).toBe("filled");
    expect(fields.notifyChannel.value).toBe("Finance");
  });

  test("overwrites a field's value when the user corrects it", () => {
    const state = applyBaseSchema(invoicePlan);
    const firstPass = mergeUpdates(
      state,
      { triggerApp: { value: "Gmail", evidence: "Gmail" } },
      "Use Gmail"
    );
    const secondPass = mergeUpdates(
      { ...state, fields: firstPass.fields },
      { triggerApp: { value: "Outlook", evidence: "Outlook" } },
      "Actually use Outlook"
    );

    expect(secondPass.fields.triggerApp.value).toBe("Outlook");
    expect(secondPass.fields.triggerApp.status).toBe("filled");
  });
});
