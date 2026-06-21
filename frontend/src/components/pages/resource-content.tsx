import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { JsonDetail } from "@/components/common/json-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ResourceContentProps<T> = {
  query: { isLoading: boolean; error: unknown; refetch: () => void };
  rows: T[];
  selected: T | null;
  onSelect: (row: T) => void;
  columns: string[];
  renderRow: (row: T) => ReactNode[];
};

export function ResourceFrame<T>({
  title,
  subtitle,
  actionLabel,
  onCreate,
  children,
  ...contentProps
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onCreate: () => void;
  children: ReactNode;
} & ResourceContentProps<T>) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        }
      />
      <ResourceContent {...contentProps} />
      {children}
    </>
  );
}

export function ResourceContent<T>({ query, rows, selected, onSelect, columns, renderRow }: ResourceContentProps<T>) {
  const active = selected ?? rows[0] ?? null;

  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!rows.length) return <EmptyPanel />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card>
        <CardContent className="p-3">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={index}
                  onClick={() => onSelect(row)}
                  className={row === active ? "bg-blue-50 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.3)]" : "hover:bg-slate-50"}
                >
                  {renderRow(row).map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <JsonDetail title="Selected record" value={active} />
    </div>
  );
}

