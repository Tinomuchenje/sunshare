import type { ReactNode } from "react";

interface Column {
  label: string;
  right?: boolean;
}

interface Row {
  key: string;
  cells: ReactNode[];
}

/** A plain ledger: a table on wider screens, a stack of small cards on phones. */
export function Table({ caption, head, rows }: { caption: string; head: Column[]; rows: Row[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              {head.map((h) => (
                <th key={h.label} scope="col" className={`px-5 py-3 font-medium ${h.right ? "text-right" : ""}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                {r.cells.map((cell, i) => (
                  <td key={head[i].label} className={`px-5 py-3 ${head[i].right ? "tabular text-right" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-card border border-line bg-surface p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {r.cells.map((cell, i) => (
                <div key={head[i].label} className="min-w-0">
                  <dt className="text-xs text-muted">{head[i].label}</dt>
                  <dd className={`mt-0.5 ${head[i].right ? "tabular font-medium" : ""}`}>{cell}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
