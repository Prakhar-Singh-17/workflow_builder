const KIND_ICON = {
  trigger: "⚡",
  condition: "❓",
  action: "⚙️",
  end: "🏁",
};

function NodeBox({ node }) {
  return (
    <div className="w-40 shrink-0 rounded-lg border border-slate-300 bg-slate-50 p-3 text-center shadow-sm">
      <div className="text-xl">{KIND_ICON[node.kind] ?? "🔹"}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{node.label}</div>
      {node.app && <div className="mt-0.5 text-xs text-slate-500">{node.app}</div>}
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Workflow</h2>
        <button
          type="button"
          onClick={() => downloadWorkflow(workflow)}
          className="text-sm text-slate-500 hover:text-slate-800"
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
                  <div className="mt-2 text-xs text-slate-400">no → {labelOf(noEdge.to)}</div>
                )}
              </div>

              {next && (
                <div className="mx-1 flex flex-col items-center pt-6 text-slate-400">
                  {mainEdge?.label && (
                    <span className="mb-0.5 text-xs font-medium text-slate-500">{mainEdge.label}</span>
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
