import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import {
  KeyValueDraftEditor,
  createKeyValueDraft,
  keyValueDraftsToRecord,
  validateKeyValueDrafts,
  type KeyValueDraft as TagDraft,
} from "@/components/ui/key-value-draft-editor";
import { listTagDefinitions, queryKeys } from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import type { TagResourceType } from "@/lib/api-types";

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
  resourceType,
  onReplace,
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
  resourceType?: TagResourceType;
  onReplace?: (tags: TagDraft[]) => void;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Omit<TagDraft, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const prefetchedDefaults = useRef(false);
  const { workspaceId } = useAppContext();
  const definitionsQuery = useQuery({
    queryKey: [...queryKeys.tagDefinitions(resourceType), workspaceId || "none"] as const,
    queryFn: () => listTagDefinitions(resourceType),
    enabled: Boolean(resourceType && workspaceId),
    staleTime: 60_000,
  });
  const suggestions = definitionsQuery.data ?? [];
  const keyValueDefinitions = suggestions.map((definition) => ({
    key: definition.key,
    description: definition.description,
    allowedValues: definition.allowedValues,
  }));

  useEffect(() => {
    if (prefetchedDefaults.current || !onReplace) {
      return;
    }
    if (!resourceType || definitionsQuery.isLoading) {
      return;
    }
    if (tags.some((tag) => tag.key.trim() || tag.value.trim())) {
      prefetchedDefaults.current = true;
      return;
    }

    const defaults = suggestions.filter((definition) => definition.defaultValue !== null && definition.defaultValue !== "");
    prefetchedDefaults.current = true;
    if (!defaults.length) {
      return;
    }

    onReplace([...defaults.map((definition) => createKeyValueDraft(definition.key, definition.defaultValue ?? "")), createKeyValueDraft()]);
  }, [definitionsQuery.isLoading, onReplace, resourceType, suggestions, tags]);

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
          definitions={keyValueDefinitions}
          error={error}
        />
      </CardContent>
    </Card>
  );
}

