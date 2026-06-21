import { useId, useState } from "react";
import { Info, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type KeyValueListItem = {
  id: string;
  key: string;
  value: string;
};

export type KeyValueDefinition = {
  key: string;
  description?: string | null;
  allowedValues?: string[];
};

export function KeyValueList({
  items,
  definitions = [],
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  emptyLabel = "No key/value pairs added.",
  hideLastRemove = false,
  disabled = false,
  onChange,
  onRemove,
}: {
  items: KeyValueListItem[];
  definitions?: KeyValueDefinition[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  hideLastRemove?: boolean;
  disabled?: boolean;
  onChange: (id: string, patch: Partial<Omit<KeyValueListItem, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const datalistId = useId();
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  return (
    <div className="overflow-hidden">
      {items.length ? (
        <>
          <datalist id={datalistId}>
            {definitions.map((definition) => (
              <option key={definition.key} value={definition.key} />
            ))}
          </datalist>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2">
                  <span aria-hidden="true" />
                  <span>Key</span>
                </div>
              </TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y-0">
          {items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2">
                  <DefinitionInfo definition={definitionByKey.get(item.key.trim())} />
                  <UnderlineInput
                    disabled={disabled}
                    value={item.key}
                    onChange={(event) => onChange(item.id, { key: event.target.value })}
                    placeholder={keyPlaceholder}
                    list={datalistId}
                  />
                </div>
              </TableCell>
              <TableCell>
                {definitionByKey.get(item.key.trim())?.allowedValues?.length ? (
                  <UnderlineSelect
                    disabled={disabled}
                    value={item.value}
                    onChange={(event) => onChange(item.id, { value: event.target.value })}
                  >
                    <option value="" disabled>
                      {valuePlaceholder || "Select value"}
                    </option>
                    {definitionByKey.get(item.key.trim())?.allowedValues?.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </UnderlineSelect>
                ) : (
                  <UnderlineInput disabled={disabled} value={item.value} onChange={(event) => onChange(item.id, { value: event.target.value })} placeholder={valuePlaceholder} />
                )}
              </TableCell>
              <TableCell className="w-10">
                {disabled || (hideLastRemove && index === items.length - 1) ? null : (
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label="Remove key/value pair">
                    <Trash2 className="h-4 w-4 text-slate-500" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          </TableBody>
          </Table>
        </>
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm font-medium text-slate-500">{emptyLabel}</div>
      )}
    </div>
  );
}

function DefinitionInfo({ definition }: { definition?: KeyValueDefinition }) {
  if (!definition?.description) {
    return <span className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400"
      title={definition.description}
      aria-label={definition.description}
    >
      <Info className="h-3.5 w-3.5" />
    </span>
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

function UnderlineSelect({ onBlur, onFocus, style, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);

  return (
    <select
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
      className="h-7 w-full appearance-none border-0 border-b border-solid bg-transparent px-1 pb-0.5 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none"
    >
      {children}
    </select>
  );
}

