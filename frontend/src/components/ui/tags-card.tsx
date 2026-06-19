import { Card, CardContent } from "@/components/ui/card";
import {
  KeyValueDraftEditor,
  createKeyValueDraft,
  keyValueDraftsToRecord,
  validateKeyValueDrafts,
  type KeyValueDraft as TagDraft,
} from "@/components/ui/key-value-draft-editor";

export type { TagDraft };
export { createKeyValueDraft as createTagDraft, keyValueDraftsToRecord as tagsToRecord, validateKeyValueDrafts as validateTagDrafts };

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
  return (
    <Card>
      <CardContent className="p-4">
        <KeyValueDraftEditor
          items={tags}
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          title={title}
          description={description}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          emptyLabel={emptyLabel}
          disabled={disabled}
          error={error}
        />
      </CardContent>
    </Card>
  );
}
