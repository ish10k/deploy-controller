import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/deployments/status-badge";
import { ResourceFrame } from "@/components/pages/resource-content";
import { ComponentDialog } from "@/components/pages/resource-dialogs";
import { Badge } from "@/components/ui/badge";
import { listComponents, putComponent, queryKeys, type ApiComponent } from "@/lib/api-client";
import { tagSummary } from "@/lib/format";

export function ComponentsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ApiComponent | null>(null);
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const mutation = useMutation({
    mutationFn: (component: ApiComponent) => putComponent(component.componentId, component),
    onSuccess: async (component) => {
      setSelected(component);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.components });
    },
  });

  return (
    <ResourceFrame
      title="Components"
      subtitle="Deployable units registered in the control plane."
      actionLabel="Component"
      onCreate={() => setOpen(true)}
      query={query}
      rows={query.data ?? []}
      selected={selected}
      onSelect={setSelected}
      columns={["Component", "Type", "Active", "Tags"]}
      renderRow={(component) => [
        component.componentId,
        component.type ?? "-",
        component.active ? <StatusBadge status="healthy" /> : <Badge>Inactive</Badge>,
        tagSummary(component.tags),
      ]}
    >
      <ComponentDialog open={open} onClose={() => setOpen(false)} onSubmit={(value) => mutation.mutate(value)} pending={mutation.isPending} />
    </ResourceFrame>
  );
}
