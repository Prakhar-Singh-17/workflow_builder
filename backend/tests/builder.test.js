import { buildWorkflow } from "../services/builder.js";
import { applyBaseSchema } from "../services/stateManager.js";
import { invoicePlan, cicdPlan } from "./fixtures/plans.js";

// Fills every field with a placeholder value so the state looks "complete"
// enough to build a workflow from.
function fillAllFields(state) {
  for (const fieldId of state.fieldOrder) {
    state.fields[fieldId] = { ...state.fields[fieldId], value: `value-${fieldId}`, status: "filled" };
  }
  return state;
}

describe("buildWorkflow", () => {
  test("always ends with exactly one 'end' node", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { nodes } = buildWorkflow(state);

    const endNodes = nodes.filter((n) => n.kind === "end");
    expect(endNodes).toHaveLength(1);
    expect(nodes.at(-1).id).toBe("end");
  });

  test("produces one node per component plus the end node", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { nodes } = buildWorkflow(state);
    expect(nodes).toHaveLength(state.components.length + 1);
  });

  test("chains non-condition components with a plain edge", () => {
    const state = fillAllFields(applyBaseSchema(cicdPlan));
    const { edges } = buildWorkflow(state);

    // trigger -> build is a plain edge (build is an action, not a condition)
    const triggerEdge = edges.find((e) => e.from === "trigger");
    expect(triggerEdge).toEqual({ from: "trigger", to: "build" });
  });

  test("a condition component branches into yes/no edges, no always going to end", () => {
    const state = fillAllFields(applyBaseSchema(cicdPlan));
    const { edges } = buildWorkflow(state);

    const yesEdge = edges.find((e) => e.from === "test" && e.label === "yes");
    const noEdge = edges.find((e) => e.from === "test" && e.label === "no");

    expect(yesEdge).toEqual({ from: "test", to: "deploy", label: "yes" });
    expect(noEdge).toEqual({ from: "test", to: "end", label: "no" });
  });

  test("the last component connects to end", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { edges } = buildWorkflow(state);
    const lastComponentId = state.components.at(-1).id;
    expect(edges.find((e) => e.from === lastComponentId && e.to === "end")).toBeDefined();
  });

  test("each node's config only contains fields that belong to that component", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { nodes } = buildWorkflow(state);

    const triggerNode = nodes.find((n) => n.id === "trigger");
    expect(triggerNode.config).toHaveProperty("triggerApp");
    expect(triggerNode.config).toHaveProperty("triggerEvent");
    expect(triggerNode.config).not.toHaveProperty("notifyChannel");

    const notifyNode = nodes.find((n) => n.id === "notify");
    expect(notifyNode.config).toHaveProperty("notifyChannel");
    expect(notifyNode.config).not.toHaveProperty("triggerApp");
  });

  test("additionalPreferences (componentId: null) doesn't end up on any component's config", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { nodes } = buildWorkflow(state);
    for (const node of nodes) {
      expect(node.config).not.toHaveProperty("additionalPreferences");
    }
  });

  test("the trigger node's app is the triggerApp field's value", () => {
    const state = applyBaseSchema(invoicePlan);
    state.fields.triggerApp = { ...state.fields.triggerApp, value: "Gmail", status: "filled" };
    const { nodes } = buildWorkflow(state);
    expect(nodes.find((n) => n.id === "trigger").app).toBe("Gmail");
  });

  test("non-trigger nodes have app: null", () => {
    const state = fillAllFields(applyBaseSchema(invoicePlan));
    const { nodes } = buildWorkflow(state);
    for (const node of nodes) {
      if (node.kind !== "trigger") expect(node.app).toBeNull();
    }
  });
});
