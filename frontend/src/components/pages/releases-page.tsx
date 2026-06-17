import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/api-state";
import { ResourceContent } from "@/components/pages/resource-content";
import { ReleaseDialog } from "@/components/pages/resource-dialogs";
import { Button } from "@/components/ui/button";
import { createRelease, listReleases, queryKeys, type ApiRelease } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export function ReleasesPage() {
  const [componentFilter, setComponentFilter] = useState("");
  const [selected, setSelected] = useState<ApiRelease | null>(null);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.releases(componentFilter || undefined), queryFn: () => listReleases(componentFilter || undefined) });
  const mutation = useMutation({
    mutationFn: createRelease,
    onSuccess: async (release) => {
      setSelected(release);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
  });

  return (
    <>
      <PageHeader
        title="Releases"
        subtitle="Component artifact versions available to DeploySets."
        action={
          <div className="flex gap-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600">
              <Filter className="h-4 w-4" />
              <input
                value={componentFilter}
                onChange={(event) => setComponentFilter(event.target.value)}
                placeholder="component id"
                className="w-32 bg-transparent outline-none"
              />
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Release
            </Button>
          </div>
        }
      />
      <ResourceContent
        query={query}
        rows={query.data ?? []}
        selected={selected}
        onSelect={setSelected}
        columns={["Component", "Version", "Created", "Artifact"]}
        renderRow={(release) => [release.componentId, release.version, formatDateTime(release.createdAt), release.artifact.key]}
      />
      <ReleaseDialog open={open} onClose={() => setOpen(false)} onSubmit={(value) => mutation.mutate(value)} pending={mutation.isPending} />
    </>
  );
}
