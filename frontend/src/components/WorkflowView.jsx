const KIND_ICON = {
  trigger: "⚡",
  condition: "❓",
  action: "⚙️",
  end: "🏁",
};

// "triggerApp" already renders as the app badge for trigger nodes — showing
// it again in the config list below would just be the same value twice.
const HIDDEN_CONFIG_KEYS_BY_KIND = {
  trigger: new Set(["triggerApp"]),
};

// camelCase field id -> "Title Case" label, e.g. "minimumAmount" -> "Minimum Amount".
function formatFieldLabel(fieldId) {
  return fieldId.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function NodeBox({ node }) {
  const hiddenKeys = HIDDEN_CONFIG_KEYS_BY_KIND[node.kind];
  const configEntries = Object.entries(node.config).filter(
    ([key, value]) => value !== null && value !== undefined && value !== "" && !hiddenKeys?.has(key)
  );

  return (
    <div className="w-52 shrink-0 rounded-lg border border-stone-300 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">{KIND_ICON[node.kind] ?? "🔹"}</span>
        <span className="text-sm font-semibold text-stone-800">{node.label}</span>
      </div>

      {node.app && (
        <span className="mt-1.5 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
          {node.app}
        </span>
      )}

      {configEntries.length > 0 && (
        <dl className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-left">
          {configEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2 text-xs">
              <dt className="shrink-0 text-stone-400">{formatFieldLabel(key)}</dt>
              <dd className="truncate text-stone-700" title={String(value)}>
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function downloadWorkflow(workflow) {
  const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workflow.json";
  a.click();
  URL.revokeObjectURL(url);
}

// "workflow" is exactly builder.js's { nodes, edges } output. Nodes are
// already in execution order (trigger ... end), so the main chain renders
// left-to-right; a condition's "no" edge (which always points straight to
// "end", per builder.js) is drawn as a small side note under that node
// instead of a second horizontal lane — keeps this to plain boxes/arrows,
// no graph library.
function WorkflowView({ workflow }) {
  if (!workflow) return null;
  const { nodes, edges } = workflow;

  function edgeBetween(fromId, toId) {
    return edges.find((e) => e.from === fromId && e.to === toId);
  }
  function labelOf(nodeId) {
    return nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-stone-800">Workflow</h2>
        <button
          type="button"
          onClick={() => downloadWorkflow(workflow)}
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Download JSON
        </button>
      </div>

      <div className="flex items-start gap-2 overflow-x-auto pb-2">
        {nodes.map((node, i) => {
          const next = nodes[i + 1];
          const mainEdge = next ? edgeBetween(node.id, next.id) : null;
          const noEdge =
            node.kind === "condition" ? edges.find((e) => e.from === node.id && e.label === "no") : null;

          return (
            <div key={node.id} className="flex items-start">
              <div className="flex flex-col items-center">
                <NodeBox node={node} />
                {noEdge && (
                  <div className="mt-2 text-xs text-stone-400">no → {labelOf(noEdge.to)}</div>
                )}
              </div>

              {next && (
                <div className="mx-1 flex flex-col items-center pt-8 text-stone-400">
                  {mainEdge?.label && (
                    <span className="mb-0.5 text-xs font-semibold text-orange-600">{mainEdge.label}</span>
                  )}
                  <span className="text-xl leading-none">→</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WorkflowView;
