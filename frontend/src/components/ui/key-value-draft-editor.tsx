import { AlertTriangle } from "lucide-react";

import { KeyValueList, type KeyValueDefinition, type KeyValueListItem } from "@/components/ui/key-value-list";

export type KeyValueDraft = KeyValueListItem;

export function createKeyValueDraft(key = "", value = ""): KeyValueDraft {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    key,
    value,
  };
}

export function keyValueDraftsToRecord(items: KeyValueDraft[]) {
  return Object.fromEntries(
    items
      .map((item) => [item.key.trim(), item.value.trim()] as const)
      .filter(([key]) => key),
  );
}

export function validateKeyValueDrafts(items: KeyValueDraft[]) {
  return items.some((item) => !item.key.trim() && item.value.trim()) ? "Tag values need a key." : undefined;
}

export function KeyValueDraftEditor({
  items,
  onAdd,
  onChange,
  onRemove,
  title,
  description,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  emptyLabel = "Any",
  disabled = false,
  definitions = [],
  error,
}: {
  items: KeyValueDraft[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Omit<KeyValueListItem, "id">>) => void;
  onRemove: (id: string) => void;
  title: string;
  description?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  definitions?: KeyValueDefinition[];
  error?: string;
}) {
  const isBlank = (item: KeyValueDraft) => !item.key.trim() && !item.value.trim();

  const handleChange = (id: string, patch: Partial<Omit<KeyValueListItem, "id">>) => {
    if (disabled) {
      return;
    }

    const nextItems = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const changedIndex = nextItems.findIndex((item) => item.id === id);
    const changedItem = nextItems[changedIndex];
    const isLastItem = changedIndex === nextItems.length - 1;

    if (changedItem && isBlank(changedItem) && items.length > 1 && !isLastItem) {
      onRemove(id);
      return;
    }

    onChange(id, patch);

    if (changedItem && !isBlank(changedItem) && !nextItems.some(isBlank)) {
      onAdd();
    }
  };

  const handleRemove = (id: string) => {
    if (disabled) {
      return;
    }

    if (items.length === 1) {
      onChange(id, { key: "", value: "" });
      return;
    }

    onRemove(id);
  };

  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {description ? <div className="mt-1 text-xs font-medium text-slate-500">{description}</div> : null}
      </div>
      <KeyValueList
        items={items}
        definitions={definitions}
        keyPlaceholder={keyPlaceholder}
        valuePlaceholder={valuePlaceholder}
        emptyLabel={emptyLabel}
        hideLastRemove
        disabled={disabled}
        onChange={handleChange}
        onRemove={handleRemove}
      />
      {error ? (
        <span className="mt-3 flex items-center gap-1.5 text-xs font-normal text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  );
}
