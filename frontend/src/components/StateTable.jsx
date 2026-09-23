const STATUS_STYLES = {
  filled: "bg-green-100 text-green-700",
  missing: "bg-amber-100 text-amber-700",
  skipped: "bg-stone-100 text-stone-500",
};

const STATUS_LABELS = {
  filled: "Filled",
  missing: "Pending",
  skipped: "Skipped",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.missing}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// "collected" is exactly what GET /api/chat returns: an array of
// { label, value, status } rows, already in the order the backend asks
// about them.
function StateTable({ collected }) {
  const isEmpty = collected.length === 0;
  const isComplete = !isEmpty && collected.every((row) => row.status !== "missing");

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold text-stone-800">Collected Information</h2>
      </div>

      {isEmpty ? (
        <p className="p-4 text-sm text-stone-400">
          Nothing collected yet — start describing your automation in the chat.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-stone-500">
                <th className="px-4 py-2 font-medium">Parameter</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {collected.map((row) => (
                <tr key={row.label} className="border-b border-stone-50 last:border-0">
                  <td className="px-4 py-2 text-stone-700">{row.label}</td>
                  <td className="px-4 py-2 text-stone-800">
                    {row.value === null || row.value === undefined || row.value === "" ? (
                      <span className="text-stone-300">—</span>
                    ) : (
                      String(row.value)
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isComplete && (
        <p className="border-t border-stone-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          All information collected ✅
        </p>
      )}
    </div>
  );
}

export default StateTable;
