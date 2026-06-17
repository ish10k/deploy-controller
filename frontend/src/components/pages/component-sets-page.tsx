import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ResourceFrame } from "@/components/pages/resource-content";
import { ComponentSetDialog } from "@/components/pages/resource-dialogs";
import { listComponentSets, putComponentSet, queryKeys, type ApiComponentSet } from "@/lib/api-client";
import { formatDateTime, tagSummary } from "@/lib/format";

export function ComponentSetsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ApiComponentSet | null>(null);
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.componentSets, queryFn: listComponentSets });
  const mutation = useMutation({
    mutationFn: (componentSet: ApiComponentSet) => putComponentSet(componentSet.componentSetId, componentSet),
    onSuccess: async (componentSet) => {
      setSelected(componentSet);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.componentSets });
    },
  });

  return (
    <ResourceFrame
      title="Component Sets"
      subtitle="Required component groups used by DeploySets."
      actionLabel="Component Set"
      onCreate={() => setOpen(true)}
      query={query}
      rows={query.data ?? []}
      selected={selected}
      onSelect={setSelected}
      columns={["Component Set", "Components", "Created", "Tags"]}
      renderRow={(set) => [set.componentSetId, set.components.length, formatDateTime(set.createdAt), tagSummary(set.tags)]}
    >
      <ComponentSetDialog open={open} onClose={() => setOpen(false)} onSubmit={(value) => mutation.mutate(value)} pending={mutation.isPending} />
    </ResourceFrame>
  );
}
