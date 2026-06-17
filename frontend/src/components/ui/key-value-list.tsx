import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type KeyValueListItem = {
  id: string;
  key: string;
  value: string;
};

export function KeyValueList({
  items,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  emptyLabel = "No key/value pairs added.",
  onChange,
  onRemove,
}: {
  items: KeyValueListItem[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  onChange: (id: string, patch: Partial<Omit<KeyValueListItem, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden">
      {items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y-0">
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <UnderlineInput value={item.key} onChange={(event) => onChange(item.id, { key: event.target.value })} placeholder={keyPlaceholder} />
              </TableCell>
              <TableCell>
                <UnderlineInput value={item.value} onChange={(event) => onChange(item.id, { value: event.target.value })} placeholder={valuePlaceholder} />
              </TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label="Remove key/value pair">
                  <Trash2 className="h-4 w-4 text-slate-500" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm font-medium text-slate-500">{emptyLabel}</div>
      )}
    </div>
  );
}

function UnderlineInput({ onBlur, onFocus, style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      {...props}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      style={{
        ...style,
        borderBottomColor: focused ? "#94a3b8" : "#cbd5e1",
        borderBottomWidth: focused ? 2 : 1,
        transition: "border-bottom-color 140ms ease, border-bottom-width 140ms ease",
      }}
      className="h-7 w-full border-0 border-b border-solid bg-transparent px-1 pb-0.5 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none placeholder:text-slate-400"
    />
  );
}
