import type { ReactNode } from "react";
import { Card } from "./card";

/**
 * Card-wrapped table frame with an airy header row. Pass rows as children, or
 * leave empty to render `empty` (placeholder pages use this as their extension point).
 */
export function TableShell({ columns, children, empty }: { columns: string[]; children?: ReactNode; empty?: ReactNode }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-outline-variant/20">
              {columns.map((c) => (
                <th key={c} scope="col" className="eyebrow px-6 py-4 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15 text-body-sm">{children}</tbody>
        </table>
      </div>
      {!children && empty}
    </Card>
  );
}
