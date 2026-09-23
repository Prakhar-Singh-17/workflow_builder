import {
  isFieldRequired,
  getNextMissingField,
  isComplete,
  getCollectedSummary,
} from "../services/planner.js";
import { applyBaseSchema } from "../services/stateManager.js";
import { invoicePlan, cicdPlan } from "./fixtures/plans.js";

describe("isFieldRequired", () => {
  test("a field with no requiredIf is always required", () => {
    const state = applyBaseSchema(invoicePlan);
    expect(isFieldRequired(state.fields.triggerApp, state)).toBe(true);
  });

  test("a conditional field is required once its dependency matches", () => {
    const state = applyBaseSchema(invoicePlan);
    state.fields.hasAmountFilter.value = true;
    expect(isFieldRequired(state.fields.amountThreshold, state)).toBe(true);
  });

  test("a conditional field is not required while its dependency doesn't match", () => {
    const state = applyBaseSchema(invoicePlan);
    state.fields.hasAmountFilter.value = false;
    expect(isFieldRequired(state.fields.amountThreshold, state)).toBe(false);
  });

  test("a conditional field is not required while its dependency is unanswered", () => {
    const state = applyBaseSchema(invoicePlan);
    // hasAmountFilter.value is still null at this point
    expect(isFieldRequired(state.fields.amountThreshold, state)).toBe(false);
  });
});

describe("getNextMissingField", () => {
  test("returns fields in fieldOrder, first missing one first", () => {
    const state = applyBaseSchema(invoicePlan);
    const { fieldId } = getNextMissingField(state);
    expect(fieldId).toBe(state.fieldOrder[0]);
  });

  test("skips a field whose status is already filled", () => {
    const state = applyBaseSchema(invoicePlan);
    state.fields[state.fieldOrder[0]].status = "filled";
    state.fields[state.fieldOrder[0]].value = "Gmail";

    const { fieldId } = getNextMissingField(state);
    expect(fieldId).toBe(state.fieldOrder[1]);
  });

  test("conditional skip: testCommand is skipped once runTests is false", () => {
    const state = applyBaseSchema(cicdPlan);
    // Fields ahead of runTests in fieldOrder must be answered first, since
    // the walk stops at the first missing required field it finds.
    state.fields.triggerApp = { ...state.fields.triggerApp, value: "GitHub", status: "filled" };
    state.fields.triggerEvent = { ...state.fields.triggerEvent, value: "push", status: "filled" };
    state.fields.runTests = { ...state.fields.runTests, value: false, status: "filled" };

    const { fieldId, fields } = getNextMissingField(state);

    expect(fields.testCommand.status).toBe("skipped");
    expect(fieldId).not.toBe("testCommand");
  });

  test("a corrected answer re-checks a previously skipped field", () => {
    let state = applyBaseSchema(cicdPlan);
    state.fields.triggerApp = { ...state.fields.triggerApp, value: "GitHub", status: "filled" };
    state.fields.triggerEvent = { ...state.fields.triggerEvent, value: "push", status: "filled" };
    state.fields.runTests = { ...state.fields.runTests, value: false, status: "filled" };

    // First pass marks testCommand as skipped.
    let result = getNextMissingField(state);
    state = { ...state, fields: result.fields };
    expect(state.fields.testCommand.status).toBe("skipped");

    // User corrects themselves: tests should run after all.
    state.fields.runTests = { ...state.fields.runTests, value: true, status: "filled" };
    result = getNextMissingField(state);

    expect(result.fields.testCommand.status).toBe("missing");
    expect(result.fieldId).toBe("testCommand");
  });

  test("returns null once every required field is filled", () => {
    const state = applyBaseSchema(invoicePlan);
    for (const fieldId of state.fieldOrder) {
      if (fieldId === "amountThreshold") continue; // stays unrequired below
      state.fields[fieldId] = { ...state.fields[fieldId], value: "x", status: "filled" };
    }
    state.fields.hasAmountFilter.value = false; // makes amountThreshold not required

    const { fieldId } = getNextMissingField(state);
    expect(fieldId).toBeNull();
  });
});

describe("isComplete", () => {
  test("false while a pending ambiguity exists, even if all fields are filled", () => {
    const state = applyBaseSchema(invoicePlan);
    for (const fieldId of state.fieldOrder) {
      state.fields[fieldId] = { ...state.fields[fieldId], value: "x", status: "filled" };
    }
    state.pendingAmbiguity = { fieldId: "notifyChannel", question: "Which team?" };

    expect(isComplete(state)).toBe(false);
  });

  test("true once every required field is filled and there's no ambiguity", () => {
    const state = applyBaseSchema(invoicePlan);
    state.pendingAmbiguity = null;
    for (const fieldId of state.fieldOrder) {
      if (fieldId === "amountThreshold") continue;
      state.fields[fieldId] = { ...state.fields[fieldId], value: "x", status: "filled" };
    }
    state.fields.hasAmountFilter.value = false;

    expect(isComplete(state)).toBe(true);
  });
});

describe("getCollectedSummary", () => {
  test("returns one row per field, in fieldOrder, with label/value/status", () => {
    const state = applyBaseSchema(invoicePlan);
    state.fields.triggerApp = { ...state.fields.triggerApp, value: "Gmail", status: "filled" };

    const summary = getCollectedSummary(state);

    expect(summary).toHaveLength(state.fieldOrder.length);
    expect(summary[0]).toEqual({
      label: state.fields.triggerApp.label,
      value: "Gmail",
      status: "filled",
    });
  });
});
