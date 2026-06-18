import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { NotesCard } from "@/components/ui/notes-card";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createRelease, listComponents, listReleases, queryKeys, type ApiRelease } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";

export function ReleasesPage({
  embedded = false,
  createSignal = 0,
  search: externalSearch,
  refreshSignal = 0,
  onCreateComponent,
}: {
  embedded?: boolean;
  createSignal?: number;
  search?: string;
  refreshSignal?: number;
  onCreateComponent?: () => void;
} = {}) {
  const [search, setSearch] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: queryKeys.releases(componentFilter || undefined), queryFn: () => listReleases(componentFilter || undefined) });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const allReleasesQuery = useQuery({ queryKey: queryKeys.releases(), queryFn: () => listReleases() });
  const mutation = useMutation({
    mutationFn: createRelease,
    onSuccess: async (release) => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
      await navigate({ to: "/releases/$componentId/$version", params: { componentId: release.componentId, version: release.version } });
    },
  });

  useEffect(() => {
    if (createSignal > 0) {
      setOpen(true);
    }
  }, [createSignal]);
  useEffect(() => {
    if (refreshSignal > 0) {
      void query.refetch();
      void componentsQuery.refetch();
      void allReleasesQuery.refetch();
    }
  }, [refreshSignal]);
  const releases = query.data ?? [];
  const componentOptions = useMemo(() => {
    const registered = (componentsQuery.data ?? []).map((component) => component.componentId);
    const released = (allReleasesQuery.data ?? releases).map((release) => release.componentId);
    return Array.from(new Set([...registered, ...released])).sort();
  }, [allReleasesQuery.data, componentsQuery.data, releases]);
  const latestReleaseByComponent = useMemo(() => latestReleasesByComponent(allReleasesQuery.data ?? releases), [allReleasesQuery.data, releases]);
  const filteredReleases = useMemo(() => {
    const normalizedSearch = (externalSearch ?? search).trim().toLowerCase();

    return releases.filter((release) => {
      if (componentFilter && release.componentId !== componentFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [release.componentId, release.version, release.description ?? "", release.notes ?? "", release.artifact.key]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [componentFilter, externalSearch, releases, search]);

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Releases"
          subtitle="Component artifact versions available to DeploySets."
          action={
            <Button className="px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Release
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
          <Select
            variant="light"
            value={componentFilter || "all"}
            onChange={(event) => setComponentFilter(event.target.value === "all" ? "" : event.target.value)}
            className="w-[220px]"
          >
            <option value="all">Component: All</option>
            {componentOptions.map((componentId) => (
              <option key={componentId} value={componentId}>
                {componentId}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div> : null}
      {query.isLoading ? (
        <LoadingPanel label="Loading releases..." />
      ) : query.error ? (
        <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />
      ) : releases.length ? (
        embedded ? (
          filteredReleases.length ? (
            <Table>
              <ReleasesTableContent rows={filteredReleases} />
            </Table>
          ) : (
            <EmptyPanel label="No releases match the current filters." />
          )
        ) : (
          <Card className="mt-4">
            <CardContent className="p-3">
              {filteredReleases.length ? (
                <Table>
                  <ReleasesTableContent rows={filteredReleases} />
                </Table>
              ) : (
                <EmptyPanel label="No releases match the current filters." />
              )}
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyPanel label="No releases found." />
      )}
      <ReleaseDrawer
        componentOptions={componentOptions}
        latestReleaseByComponent={latestReleaseByComponent}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(value) => mutation.mutate(value)}
        pending={mutation.isPending}
        onCreateComponent={onCreateComponent}
      />
    </>
  );
}

function ReleasesTableContent({ rows }: { rows: ApiRelease[] }) {
  return (
    <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((release) => (
                    <TableRow key={`${release.componentId}:${release.version}`} className="hover:bg-slate-50">
                      <TableCell>
                        <EntityLink
                          kind="component"
                          to="/components/$componentId"
                          params={{ componentId: release.componentId }}
                        >
                          {release.componentId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>
                        <EntityLink
                          kind="release"
                          to="/releases/$componentId/$version"
                          params={{ componentId: release.componentId, version: release.version }}
                        >
                          {release.version}
                        </EntityLink>
                      </TableCell>
                      <TableCell>{formatRelativeTime(release.createdAt, { mode: "short" })}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{release.notes ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
    </>
  );
}

export function ReleaseDrawer({
  componentOptions,
  latestReleaseByComponent,
  open,
  onClose,
  onSubmit,
  pending,
  onCreateComponent,
  initialComponentId = "",
  lockComponent = false,
}: {
  componentOptions: string[];
  latestReleaseByComponent: Map<string, ApiRelease>;
  open: boolean;
  onClose: () => void;
  onSubmit: (release: ApiRelease) => void;
  pending: boolean;
  onCreateComponent?: () => void;
  initialComponentId?: string;
  lockComponent?: boolean;
}) {
  const [componentId, setComponentId] = useState(initialComponentId);
  const [version, setVersion] = useState("");
  const [artifactKey, setArtifactKey] = useState("");
  const [artifactDigest, setArtifactDigest] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const trimmedComponentId = componentId.trim();
  const trimmedVersion = version.trim();
  const trimmedArtifactKey = artifactKey.trim();
  const tagsError = validateTagDrafts(tags);
  const latestRelease = latestReleaseByComponent.get(componentId);

  useEffect(() => {
    if (lockComponent) {
      setComponentId(initialComponentId);
    }
  }, [initialComponentId, lockComponent]);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const submit = () => {
    if (!trimmedComponentId || !trimmedVersion || !trimmedArtifactKey || tagsError) {
      return;
    }

    onSubmit({
      componentId: trimmedComponentId,
      version: trimmedVersion,
      description: `${trimmedComponentId} ${trimmedVersion}`,
      artifact: { key: trimmedArtifactKey, digest: artifactDigest.trim() || "" },
      source: null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
      createdBy: "amit.kumar",
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create release"
      description="Capture the component version and artifact metadata that deploy sets will consume."
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">A release is immutable and cannot be changed after creation.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedComponentId || !trimmedVersion || !trimmedArtifactKey || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create release"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Release target</h3>
          <p className="mt-1 text-sm text-slate-500">Choose the component and the immutable version label.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Component ID
              <RequiredMark />
              <Select variant="light" className="mt-1" value={componentId} onChange={(event) => setComponentId(event.target.value)} disabled={lockComponent}>
                {!componentId ? <option value="">Select component</option> : null}
                {componentId && !componentOptions.includes(componentId) ? (
                  <option value={componentId}>{componentId}</option>
                ) : null}
                {componentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              {onCreateComponent && !lockComponent ? (
                <button type="button" className="mt-2 text-xs font-bold text-blue-600" onClick={onCreateComponent}>
                  Create new component
                </button>
              ) : null}
              {componentId ? (
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  {latestRelease ? `Latest version: ${latestRelease.version}` : "No releases yet for this component."}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Version
              <RequiredMark />
              <Input className="mt-1" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="2026.06.17.1" />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Artifact</h3>
          <p className="mt-1 text-sm text-slate-500">Store the artifact key now; the digest can be refined later if the build pipeline fills it in.</p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Artifact key
              <RequiredMark />
              <Input className="mt-1" value={artifactKey} onChange={(event) => setArtifactKey(event.target.value)} placeholder="artifacts/checkout-api/2026.06.17.1.zip" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Artifact digest
              <Input className="mt-1" value={artifactDigest} onChange={(event) => setArtifactDigest(event.target.value)} placeholder="sha256:..." />
            </label>
          </div>
        </section>
        <TagsCard
          tags={tags}
          error={tagsError}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
        <NotesCard
          value={notes}
          onChange={setNotes}
          description="Capture what changed, rollout notes, or links to build context."
          placeholder="What changed, rollout notes, links to build context..."
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
