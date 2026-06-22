import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Copy, Plus, Search, X } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, useMinimumVisible } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { NotesCard } from "@/components/ui/notes-card";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  createRelease,
  listComponents,
  listReleases,
  listEnvironmentState,
  listEnvironments,
  listVersions,
  queryKeys,
  type ApiRelease,
  type ApiReleaseCreateRequest,
  type ApiEnvironmentState,
  type ApiComponent,
  type ApiVersion,
} from "@/lib/api-client";
import { formatRelativeTime, tagSummary } from "@/lib/format";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";

type ReleaseItemDraft = {
  id: string;
  componentId: string;
  version: string;
};

type ReleaseFormState = {
  releaseId: string;
  baseEnvironmentId: string;
  baseReleaseId: string;
  notes: string;
  tags: TagDraft[];
  items: ReleaseItemDraft[];
};

const draftId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const draftItem = (componentId = "", version = ""): ReleaseItemDraft => ({
  id: draftId(),
  componentId,
  version,
});

const defaultForm = (): ReleaseFormState => ({
  releaseId: "",
  baseEnvironmentId: "",
  baseReleaseId: "",
  notes: "",
  tags: [createTagDraft()],
  items: [],
});

export function ReleasesPage({
  embedded = false,
  drawerOnly = false,
  createSignal = 0,
  onCreateSignalHandled,
  search: externalSearch,
  refreshSignal = 0,
}: {
  embedded?: boolean;
  drawerOnly?: boolean;
  createSignal?: number;
  onCreateSignalHandled?: () => void;
  search?: string;
  refreshSignal?: number;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [search, setSearch] = useState("");
  const [releaseFilter, setReleaseFilter] = useState("all");

  const releasesQuery = useQuery({ queryKey: queryKeys.releases, queryFn: listReleases });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const environmentsQuery = useQuery({ queryKey: queryKeys.environments, queryFn: listEnvironments });
  const environmentStateQuery = useQuery({ queryKey: queryKeys.environmentState, queryFn: listEnvironmentState });
  const versionsQuery = useQuery({ queryKey: queryKeys.versions(), queryFn: () => listVersions() });
  const refreshing = useMinimumVisible(releasesQuery.isFetching && !releasesQuery.isLoading);

  const createMutation = useMutation({
    mutationFn: createRelease,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.releases });
      closeDrawer();
      toast({
        title: "Release created",
        description: `${result.release.releaseId} is ready with ${result.release.items.length} component versions.`,
        variant: "success",
      });
      await navigate({ to: "/releases/$releaseId", params: { releaseId: result.release.releaseId } });
    },
  });

  useEffect(() => {
    if (createSignal > 0) {
      openDrawer();
      onCreateSignalHandled?.();
    }
  }, [createSignal, onCreateSignalHandled]);
  useEffect(() => {
    if (refreshSignal > 0) {
      void releasesQuery.refetch();
      void componentsQuery.refetch();
      void environmentsQuery.refetch();
      void environmentStateQuery.refetch();
      void versionsQuery.refetch();
    }
  }, [componentsQuery.refetch, environmentStateQuery.refetch, environmentsQuery.refetch, releasesQuery.refetch, refreshSignal, versionsQuery.refetch]);

  useEffect(() => {
    if (drawerOpen) {
      setDrawerMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setDrawerMounted(false), 250);
    return () => window.clearTimeout(timeout);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerMounted) {
      return;
    }

    if (drawerOpen) {
      const frame = window.requestAnimationFrame(() => setDrawerEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setDrawerEntered(false);
  }, [drawerMounted, drawerOpen]);

  useEffect(() => {
    if (!drawerMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerMounted]);

  const openDrawer = () => {
    setDrawerMounted(true);
    setDrawerOpen(true);
    setDrawerEntered(false);
  };

  const closeDrawer = () => {
    setDrawerEntered(false);
    setDrawerOpen(false);
  };

  const releases = releasesQuery.data ?? [];
  const filteredReleases = useMemo(() => {
    const normalizedSearch = (externalSearch ?? search).trim().toLowerCase();

    return releases.filter((release) => {
      if (releaseFilter !== "all" && release.releaseId !== releaseFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [release.releaseId, release.releaseId, release.createdBy, tagSummary(release.tags)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [releaseFilter, releases, externalSearch, search]);

  if (releasesQuery.isLoading) {
    return <LoadingPanel label="Loading releases..." />;
  }

  if (releasesQuery.error) {
    return <ApiErrorPanel error={releasesQuery.error} onRetry={() => releasesQuery.refetch()} />;
  }

  const drawer = drawerMounted ? (
    <CreateReleaseDrawer
      open={drawerEntered}
      releases={releasesQuery.data ?? []}
      components={componentsQuery.data ?? []}
      environments={environmentsQuery.data ?? []}
      environmentState={environmentStateQuery.data ?? []}
      versions={versionsQuery.data ?? []}
      pending={createMutation.isPending}
      error={createMutation.error}
      onClose={closeDrawer}
      onSubmit={(request) => createMutation.mutate(request)}
    />
  ) : null;

  if (drawerOnly) {
    return <>{drawer}</>;
  }

  return (
    <div className={embedded ? "flex min-h-0 flex-col overflow-hidden" : "flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden"}>
      {!embedded ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-normal text-slate-950">Releases</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Immutable desired component-version sets ready for deployment.</p>
          </div>
          <Button className="px-4" onClick={openDrawer}>
            <Plus className="h-5 w-5" />
            Create Release
          </Button>
        </div>
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
          <Select variant="light" value={releaseFilter} onChange={(event) => setReleaseFilter(event.target.value)} className="w-[220px]">
            <option value="all">Release: All</option>
            {(releasesQuery.data ?? []).map((release) => (
              <option key={release.releaseId} value={release.releaseId}>
                {release.releaseId}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={() => releasesQuery.refetch()}>
          Refresh
        </Button>
      </div> : null}

      {embedded ? (
        <div className="relative">
          {refreshing ? <LoadingOverlay /> : null}
          {filteredReleases.length ? (
            <ScrollFade className="flex-1 rounded-t-lg">
              <ReleasesTable rows={filteredReleases} />
            </ScrollFade>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyPanel label="No Releases match the current filters." />
            </div>
          )}
        </div>
      ) : (
        <Card className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
            {refreshing ? <LoadingOverlay /> : null}
            {filteredReleases.length ? (
              <ScrollFade className="flex-1 rounded-t-lg">
                <ReleasesTable rows={filteredReleases} />
              </ScrollFade>
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <EmptyPanel label="No Releases match the current filters." />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {drawer}
    </div>
  );
}

function ReleasesTable({ rows }: { rows: ApiRelease[] }) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-white">
        <TableRow>
          <TableHead>Release</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((release) => (
          <TableRow key={release.releaseId} className="hover:bg-blue-50/40">
            <TableCell>
              <EntityLink
                kind="release"
                to="/releases/$releaseId"
                params={{ releaseId: release.releaseId }}
              >
                {release.releaseId}
              </EntityLink>
            </TableCell>
            <TableCell>
              <EntityLink
                kind="user"
                to="/users/$principalId"
                params={{ principalId: release.createdBy }}
              >
                {release.createdBy}
              </EntityLink>
            </TableCell>
            <TableCell>{formatRelativeTime(release.createdAt, { mode: "short" })}</TableCell>
            <TableCell>
              <TagList tags={release.tags} limit={3} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateReleaseDrawer({
  open,
  releases,
  components,
  environments,
  environmentState,
  versions,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  releases: ApiRelease[];
  components: ApiComponent[];
  environments: { environmentId: string }[];
  environmentState: ApiEnvironmentState[];
  versions: ApiVersion[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (request: ApiReleaseCreateRequest) => void;
}) {
  const [form, setForm] = useState<ReleaseFormState>(() => defaultForm());
  const activeComponentIds = useMemo(
    () => components.filter((component) => component.active).map((component) => component.componentId),
    [components],
  );
  const releaseById = useMemo(() => new Map(releases.map((release) => [release.releaseId, release])), [releases]);
  const environmentStateById = useMemo(() => new Map(environmentState.map((state) => [state.environmentId, state])), [environmentState]);
  const versionsByComponent = useMemo(() => {
    const grouped = new Map<string, ApiVersion[]>();

    for (const version of versions) {
      grouped.set(version.componentId, [...(grouped.get(version.componentId) ?? []), version]);
    }

    for (const [componentId, componentVersions] of grouped) {
      grouped.set(
        componentId,
        [...componentVersions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      );
    }

    return grouped;
  }, [versions]);
  const resolvedBaseRelease = useMemo(() => {
    if (form.baseReleaseId) {
      return releaseById.get(form.baseReleaseId);
    }

    const state = form.baseEnvironmentId ? environmentStateById.get(form.baseEnvironmentId) : undefined;
    return state?.releaseId ? releaseById.get(state.releaseId) : undefined;
  }, [releaseById, environmentStateById, form.baseReleaseId, form.baseEnvironmentId]);

  const errors = validateForm(form);
  const canSubmit = Boolean(form.releaseId.trim()) && Object.keys(errors).length === 0 && !pending;
  const parsedTags = tagsToRecord(form.tags);

  useEffect(() => {
    setForm((current) => {
      const existingByComponent = new Map(current.items.map((item) => [item.componentId, item]));
      const nextItems = activeComponentIds.map((componentId) => {
        const existing = existingByComponent.get(componentId);
        return existing ? { ...existing } : draftItem(componentId);
      });

      if (
        nextItems.length === current.items.length &&
        nextItems.every((item, index) => item.componentId === current.items[index]?.componentId && item.version === current.items[index]?.version)
      ) {
        return current;
      }

      return { ...current, items: nextItems };
    });
  }, [activeComponentIds]);

  const updateItemVersion = (id: string, version: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, version } : item)),
    }));
  };

  const useBaseForItems = () => {
    if (!resolvedBaseRelease) {
      return;
    }

    const baseItemByComponent = new Map(resolvedBaseRelease.items.map((item) => [item.componentId, item]));

    setForm((current) => ({
      ...current,
      items: current.items.length
        ? current.items.map((item) => ({
            ...item,
            version: baseItemByComponent.get(item.componentId)?.version ?? item.version,
          }))
        : resolvedBaseRelease.items.map((item) => draftItem(item.componentId, item.version)),
    }));
  };

  const updateTag = (id: string, patch: Partial<TagDraft>) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)),
    }));
  };

  const removeTag = (id: string) => {
    setForm((current) => ({ ...current, tags: current.tags.filter((tag) => tag.id !== id) }));
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      releaseId: form.releaseId,
      baseEnvironmentId: form.baseEnvironmentId || null,
      baseReleaseId: form.baseReleaseId || null,
      notes: form.notes.trim() || null,
      items: form.items.map((item) => ({ componentId: item.componentId.trim(), version: item.version.trim() })),
      createdBy: "amit.kumar",
      tags: parsedTags,
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close Release creator"
        className={`absolute inset-0 z-0 bg-slate-950/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 z-10 flex h-full w-full max-w-[860px] transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Create Release"
      >
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Create Release</h2>
            <p className="mt-1 text-sm text-slate-600">Compose an immutable desired state from pinned component versions.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close Release creator">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-5">
          <ScrollFade className="h-full rounded-lg" contentClassName="space-y-4 pr-1">
            <SectionCard title="Identity" description="Name the Release.">
              <div className="mb-4 grid grid-cols-1 gap-3">
                <Field label="Release ID" required>
                  <Input value={form.releaseId} onChange={(event) => setForm({ ...form, releaseId: event.target.value })} placeholder="Enter release ID" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Components"
              required
              description="Choose one source to derive context from, then set the desired versions for this version set."
              action={
                <Button type="button" variant="outline" disabled={!resolvedBaseRelease} onClick={useBaseForItems}>
                  Set versions from base
                </Button>
              }
            >
              <div className="flex items-end gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-slate-800">
                  Base environment
                  <Select
                    variant="light"
                    value={form.baseEnvironmentId}
                    onChange={(event) => setForm({ ...form, baseEnvironmentId: event.target.value, baseReleaseId: "" })}
                  >
                    <option value=""></option>
                    {environments.map((environment) => (
                      <option key={environment.environmentId} value={environment.environmentId}>
                        {environment.environmentId}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center text-xs font-bold uppercase tracking-wide text-slate-400">Or</div>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-slate-800">
                  Base Release
                  <Select
                    variant="light"
                    value={form.baseReleaseId}
                    onChange={(event) => setForm({ ...form, baseReleaseId: event.target.value, baseEnvironmentId: "" })}
                  >
                    <option value=""></option>
                    {releases.map((release) => (
                      <option key={release.releaseId} value={release.releaseId}>
                        {release.releaseId}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="mt-4 overflow-hidden border-t border-slate-100 pt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>
                        Version
                        <RequiredMark />
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y-0">
                    {form.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <ReadonlyUnderlineValue value={item.componentId} />
                        </TableCell>
                        <TableCell colSpan={2}>
                          <UnderlineSelect
                            value={item.version}
                            onChange={(event) => updateItemVersion(item.id, event.target.value)}
                            aria-label={`${item.componentId} version`}
                          >
                            <option value="">Select version</option>
                            {versionOptionsForComponent(item.componentId, item.version, versionsByComponent).map((version) => (
                              <option key={version} value={version}>
                                {version}
                              </option>
                            ))}
                          </UnderlineSelect>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!form.items.length ? <p className="mt-3 text-xs font-medium text-slate-500">Active components in this workspace will appear here.</p> : null}
              {errors.items ? <InlineFormError message={errors.items} /> : null}
            </SectionCard>

            <TagsCard
              tags={form.tags}
              error={errors.tags}
              resourceType="release"
              onReplace={(tags) => setForm((current) => ({ ...current, tags }))}
              onAdd={() => setForm((current) => ({ ...current, tags: [...current.tags, createTagDraft()] }))}
              onChange={updateTag}
              onRemove={removeTag}
            />

            <NotesCard
              value={form.notes}
              onChange={(notes) => setForm((current) => ({ ...current, notes }))}
              description="Capture why this Release was created, approval context, or rollout intent."
              placeholder="Why this Release was created, approval context, rollout intent..."
            />

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-normal text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error instanceof Error ? error.message : "Unable to create Release."}
              </div>
            ) : null}
          </ScrollFade>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-slate-500">
            Releases are immutable after creation, so double-check component versions before saving.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={submit}>
              <CheckCheck className="h-4 w-4" />
              Create Release
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  required = false,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-950">
              {title}
              {required ? <RequiredMark /> : null}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">{description}</div>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  hint,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <RequiredMark /> : null}
        {children}
      </label>
      {hint ? <span className="text-xs font-medium text-slate-500">{hint}</span> : null}
      {error ? <InlineFormError message={error} /> : null}
    </div>
  );
}

function InlineFormError({ message }: { message: string }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-xs font-normal text-red-600">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </span>
  );
}

function UnderlineSelect({ children, onBlur, onFocus, style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
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
      className="h-7 w-full appearance-none border-0 border-b border-solid bg-transparent px-1 pb-0.5 text-sm font-medium text-slate-950 outline-none"
    >
      {children}
    </select>
  );
}

function ReadonlyUnderlineValue({ value }: { value: string }) {
  return (
    <div
      className="flex h-7 w-full items-center border-0 border-b border-solid bg-transparent px-1 pb-0.5 text-sm font-semibold text-slate-900"
      style={{ borderBottomColor: "#cbd5e1", borderBottomWidth: 1 }}
    >
      {value}
    </div>
  );
}

function versionOptionsForComponent(componentId: string, currentVersion: string, versionsByComponent: Map<string, ApiVersion[]>) {
  const versions = versionsByComponent.get(componentId)?.map((version) => version.version) ?? [];
  return Array.from(new Set([currentVersion, ...versions].filter(Boolean)));
}

function validateForm(form: ReleaseFormState) {
  const errors: Partial<Record<keyof ReleaseFormState, string>> = {};

  if (!form.releaseId) {
    errors.releaseId = "Choose a version set.";
  }

  const tagError = validateTagDrafts(form.tags);
  if (tagError) {
    errors.tags = tagError;
  }

  if (!form.items.length) {
    errors.items = "Add at least one component version.";
  } else if (form.items.some((item) => !item.componentId.trim() || !item.version.trim())) {
    errors.items = "Every component needs a selected version.";
  }

  return errors;
}
