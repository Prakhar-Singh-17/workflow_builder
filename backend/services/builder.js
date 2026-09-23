// PURE and deterministic: given a finished session state, always produces
// the same { nodes, edges }. No LLM calls — once collection is complete,
// there's nothing left to decide, only to assemble.

// Every field belonging to a component becomes part of that component's
// config, keyed by field id.
function configForComponent(state, componentId) {
  const config = {};
  for (const fieldId of state.fieldOrder) {
    const field = state.fields[fieldId];
    if (field.componentId === componentId) {
      config[fieldId] = field.value;
    }
  }
  return config;
}

export function buildWorkflow(state) {
  const nodes = state.components.map((component) => ({
    id: component.id,
    kind: component.kind,
    label: component.label,
    // Only the trigger has a well-known "which app" field across every
    // domain (see config/baseSchema.js); other components' config still
    // holds their own values, just not surfaced as this shorthand.
    app: component.kind === "trigger" ? state.fields.triggerApp?.value ?? null : null,
    config: configForComponent(state, component.id),
  }));
  nodes.push({ id: "end", kind: "end", label: "End", app: null, config: {} });

  const edges = [];
  for (let i = 0; i < state.components.length; i++) {
    const current = state.components[i];
    const next = state.components[i + 1]?.id ?? "end";

    if (current.kind === "condition") {
      edges.push({ from: current.id, to: next, label: "yes" });
      edges.push({ from: current.id, to: "end", label: "no" });
    } else {
      edges.push({ from: current.id, to: next });
    }
  }

  return { nodes, edges };
}
