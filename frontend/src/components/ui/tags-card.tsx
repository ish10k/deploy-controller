import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { KeyValueList, type KeyValueListItem } from "@/components/ui/key-value-list";

export type TagDraft = KeyValueListItem;

export function createTagDraft(key = "", value = ""): TagDraft {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    key,
    value,
  };
}

export function tagsToRecord(tags: TagDraft[]) {
  return Object.fromEntries(
    tags
      .map((tag) => [tag.key.trim(), tag.value.trim()] as const)
      .filter(([key]) => key),
  );
}

export function validateTagDrafts(tags: TagDraft[]) {
  return tags.some((tag) => !tag.key.trim() && tag.value.trim())
    ? "Tag values need a key."
    : undefined;
}

export function TagsCard({
  tags,
  error,
  title = "Tags",
  description = "Add metadata as structured key/value pairs.",
  keyPlaceholder = "Add tag",
  valuePlaceholder = "",
  emptyLabel = "No tags added.",
  disabled = false,
  onAdd,
  onChange,
  onRemove,
}: {
  tags: TagDraft[];
  error?: string;
  title?: string;
  description?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Omit<TagDraft, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const parsedTags = tagsToRecord(tags);
  const isBlankTag = (tag: TagDraft) => !tag.key.trim() && !tag.value.trim();

  const handleChange = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    if (disabled) {
      return;
    }

    const nextTags = tags.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag));
    const changedIndex = nextTags.findIndex((tag) => tag.id === id);
    const changedTag = nextTags[changedIndex];
    const isLastTag = changedIndex === nextTags.length - 1;

    if (changedTag && isBlankTag(changedTag) && tags.length > 1 && !isLastTag) {
      onRemove(id);
      return;
    }

    onChange(id, patch);

    if (changedTag && !isBlankTag(changedTag) && !nextTags.some(isBlankTag)) {
      onAdd();
    }
  };

  const handleRemove = (id: string) => {
    if (disabled) {
      return;
    }

    if (tags.length === 1) {
      onChange(id, { key: "", value: "" });
      return;
    }

    onRemove(id);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4">
          <div>
            <div className="text-sm font-bold text-slate-950">{title}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">{description}</div>
          </div>
        </div>
        <KeyValueList
          items={tags}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          emptyLabel={emptyLabel}
          hideLastRemove
          disabled={disabled}
          onChange={handleChange}
          onRemove={handleRemove}
        />
        {Object.entries(parsedTags).length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(parsedTags).map(([key, value]) => (
              <span key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {value ? `${key}:${value}` : key}
              </span>
            ))}
          </div>
        ) : null}
        {error ? (
          <span className="mt-3 flex items-center gap-1.5 text-xs font-normal text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
