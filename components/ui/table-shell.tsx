import type { Key, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * Card-wrapped table frame with an airy header row. Supports either:
 *  - presentational mode: pass raw <tr> rows as children
 *  - data mode: pass typed columns + rows and let the shell map rows consistently
 */
type TableAlign = "left" | "center" | "right";

const ALIGN_CLASS: Record<TableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export type TableColumn<Row> = {
  key: string;
  header: ReactNode;
  renderCell: (row: Row) => ReactNode;
  align?: TableAlign;
  headerClassName?: string;
  cellClassName?: string;
};

type BaseTableProps = {
  empty?: ReactNode;
  tableClassName?: string;
};

type PresentationalTableProps = BaseTableProps & {
  columns: string[];
  children?: ReactNode;
};

type DataTableProps<Row> = BaseTableProps & {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => Key;
};

function isDataTableProps<Row>(props: PresentationalTableProps | DataTableProps<Row>): props is DataTableProps<Row> {
  return "rows" in props;
}

export function TableShell<Row>(props: PresentationalTableProps | DataTableProps<Row>) {
  const dataMode = isDataTableProps(props);
  const hasContent = dataMode ? props.rows.length > 0 : Boolean(props.children);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-[640px] text-left", props.tableClassName)}>
          <thead>
            <tr className="border-b border-outline-variant/20">
              {dataMode
                ? props.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn("eyebrow px-6 py-4 font-semibold", ALIGN_CLASS[column.align ?? "left"], column.headerClassName)}
                    >
                      {column.header}
                    </th>
                  ))
                : props.columns.map((column) => (
                    <th key={column} scope="col" className="eyebrow px-6 py-4 font-semibold">
                      {column}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15 text-body-sm">
            {dataMode
              ? props.rows.map((row) => (
                  <tr key={props.rowKey(row)}>
                    {props.columns.map((column) => (
                      <td key={column.key} className={cn("px-6 py-4", ALIGN_CLASS[column.align ?? "left"], column.cellClassName)}>
                        {column.renderCell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : props.children}
          </tbody>
        </table>
      </div>
      {!hasContent && props.empty}
    </Card>
  );
}
