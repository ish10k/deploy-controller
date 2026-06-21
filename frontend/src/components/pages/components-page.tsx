import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, PageHeader, useMinimumVisible } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";
import { useAppContext } from "@/lib/app-context";
import { listComponents, listReleases, putComponent, queryKeys, type ApiComponent, type ApiRelease } from "@/lib/api-client";
import { tagSummary } from "@/lib/format";
import { Plus, Search } from "lucide-react";

export function ComponentsPage({
  embedded = false,
  createSignal = 0,
  search: externalSearch,
  refreshSignal = 0,
}: {
  embedded?: boolean;
  createSignal?: number;
  search?: string;
  refreshSignal?: number;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const { workspaceId } = useAppContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const releasesQuery = useQuery({ queryKey: queryKeys.releases(), queryFn: () => listReleases() });
  const refreshing = useMinimumVisible(componentsQuery.isFetching && !componentsQuery.isLoading);
  const mutation = useMutation({
    mutationFn: (component: ApiComponent) => putComponent(component.componentId, component),
    onSuccess: async (component) => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.components });
      await navigate({ to: "/components/$componentId", params: { componentId: component.componentId } });
    },
  });

  useEffect(() => {
    if (createSignal > 0) {
      setOpen(true);
    }
  }, [createSignal]);
  useEffect(() => {
    if (refreshSignal > 0) {
      void componentsQuery.refetch();
      void releasesQuery.refetch();
    }
  }, [refreshSignal]);
  const latestReleaseByComponent = useMemo(() => latestReleasesByComponent(releasesQuery.data ?? []), [releasesQuery.data]);
  const components = componentsQuery.data ?? [];
  const componentTypes = useMemo(() => {
    return Array.from(new Set(components.map((component) => component.type).filter(Boolean))).sort() as string[];
  }, [components]);
  const filteredComponents = useMemo(() => {
    const normalizedSearch = (externalSearch ?? search).trim().toLowerCase();

    return components.filter((component) => {
      const latestRelease = latestReleaseByComponent.get(component.componentId);
      if (typeFilter !== "all" && component.type !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [component.componentId, component.type ?? "", latestRelease?.version ?? "", tagSummary(component.tags)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [components, externalSearch, latestReleaseByComponent, search, typeFilter]);

  if (componentsQuery.isLoading) return <LoadingPanel label="Loading components..." />;
  if (componentsQuery.error) return <ApiErrorPanel error={componentsQuery.error} onRetry={() => componentsQuery.refetch()} />;
  if (!componentsQuery.data?.length) return <EmptyPanel label="No components found." />;

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Components"
          subtitle="Deployable units registered in the control plane."
          action={
            <Button className="px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Component
            </Button>
          }
        />
      ) : null}
      {!embedded ? <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-[310px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Select variant="light" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-[180px]">
            <option value="all">Type: All</option>
            {componentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={() => componentsQuery.refetch()}>
          Refresh
        </Button>
      </div> : null}
      {embedded ? (
        <div className="relative">
          {refreshing ? <LoadingOverlay /> : null}
          {filteredComponents.length ? (
            <Table>
              <ComponentsTableContent rows={filteredComponents} latestReleaseByComponent={latestReleaseByComponent} />
            </Table>
          ) : (
            <EmptyPanel label="No components match the current filters." />
          )}
        </div>
      ) : (
        <Card className="relative mt-4 overflow-hidden">
          <CardContent className="p-3">
            {refreshing ? <LoadingOverlay /> : null}
            {filteredComponents.length ? (
              <Table>
                <ComponentsTableContent rows={filteredComponents} latestReleaseByComponent={latestReleaseByComponent} />
              </Table>
            ) : (
              <EmptyPanel label="No components match the current filters." />
            )}
          </CardContent>
        </Card>
      )}
      <ComponentDrawer
        typeOptions={componentTypes}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(value) => mutation.mutate(value)}
        pending={mutation.isPending}
      />
    </>
  );
}

function ComponentsTableContent({ rows, latestReleaseByComponent }: { rows: ApiComponent[]; latestReleaseByComponent: Map<string, ApiRelease> }) {
  return (
    <>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Latest Release</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((component) => {
                  const latestRelease = latestReleaseByComponent.get(component.componentId);
                  return (
                    <TableRow key={component.componentId} className="hover:bg-slate-50">
                      <TableCell>
                        <EntityLink
                          kind="component"
                          to="/components/$componentId"
                          params={{ componentId: component.componentId }}
                        >
                          {component.componentId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>{component.type ?? "-"}</TableCell>
                      <TableCell>
                        {latestRelease ? (
                          <EntityLink
                            kind="release"
                            to="/releases/$componentId/$version"
                            params={{ componentId: latestRelease.componentId, version: latestRelease.version }}
                          >
                            {latestRelease.version}
                          </EntityLink>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TagList tags={component.tags} limit={3} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
    </>
  );
}

function ComponentDrawer({
  typeOptions,
  open,
  onClose,
  onSubmit,
  pending,
}: {
  typeOptions: string[];
  open: boolean;
  onClose: () => void;
  onSubmit: (component: ApiComponent) => void;
  pending: boolean;
}) {
  const { workspaceId } = useAppContext();
  const [componentId, setComponentId] = useState("");
  const [type, setType] = useState("");
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const trimmedComponentId = componentId.trim();
  const tagsError = validateTagDrafts(tags);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const submit = () => {
    if (!trimmedComponentId || tagsError) {
      return;
    }

    onSubmit({
      workspaceId,
      componentId: trimmedComponentId,
      type: type.trim() || null,
      active,
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create component"
      description="Register a deployable unit that releases and deployments can reference."
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">Tags help filter components across releases, release sets, and deployments.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedComponentId || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create component"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <p className="mt-1 text-sm text-slate-500">Use the stable service or workload identifier people already recognize.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Component ID
              <RequiredMark />
              <Input className="mt-1" value={componentId} onChange={(event) => setComponentId(event.target.value)} placeholder="checkout-api" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Runtime type
              <Input className="mt-1" list="component-runtime-type-options" value={type} onChange={(event) => setType(event.target.value)} placeholder="ecs-service" />
              <datalist id="component-runtime-type-options">
                {typeOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active component</span>
              <span>Active components are available for new releases, release sets, and deployments.</span>
            </span>
          </label>
        </section>
        <TagsCard
          tags={tags}
          error={tagsError}
          resourceType="component"
          onReplace={setTags}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

function latestReleasesByComponent(releases: ApiRelease[]) {
  const latest = new Map<string, ApiRelease>();

  for (const release of releases) {
    const current = latest.get(release.componentId);
    if (!current || release.createdAt.localeCompare(current.createdAt) > 0) {
      latest.set(release.componentId, release);
    }
  }

  return latest;
}

