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
  createDeployset,
  listReleaseSets,
  listEnvironmentState,
  listEnvironments,
  listReleases,
  queryKeys,
  type ApiReleaseSet,
  type ApiReleaseSetCreateRequest,
  type ApiEnvironmentState,
  type ApiRelease,
} from "@/lib/api-client";
import { formatRelativeTime, tagSummary } from "@/lib/format";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";

type ReleaseSetItemDraft = {
  id: string;
  componentId: string;
  version: string;
};

type ReleaseSetFormState = {
  releaseSetId: string;
  baseEnvironmentId: string;
  baseReleaseSetId: string;
  notes: string;
  tags: TagDraft[];
  items: ReleaseSetItemDraft[];
};

const draftId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const draftItem = (componentId = "", version = ""): ReleaseSetItemDraft => ({
  id: draftId(),
  componentId,
  version,
});

const defaultForm = (): ReleaseSetFormState => ({
  releaseSetId: "",
  baseEnvironmentId: "",
  baseReleaseSetId: "",
  notes: "",
  tags: [createTagDraft()],
  items: [],
});

export function DeploysetsPage({
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
  const [releaseSetFilter, setReleaseSetFilter] = useState("all");

  const releaseSetsQuery = useQuery({ queryKey: queryKeys.releaseSets, queryFn: listReleaseSets });
  const environmentsQuery = useQuery({ queryKey: queryKeys.environments, queryFn: listEnvironments });
  const environmentStateQuery = useQuery({ queryKey: queryKeys.environmentState, queryFn: listEnvironmentState });
  const releasesQuery = useQuery({ queryKey: queryKeys.releases(), queryFn: () => listReleases() });
  const refreshing = useMinimumVisible(releaseSetsQuery.isFetching && !releaseSetsQuery.isLoading);

  const createMutation = useMutation({
    mutationFn: createDeployset,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.releaseSets });
      closeDrawer();
      toast({
        title: "ReleaseSet created",
        description: `${result.release_set.releaseSetId} is ready with ${result.release_set.items.length} component versions.`,
        variant: "success",
      });
      await navigate({ to: "/release-sets/$releaseSetId", params: { releaseSetId: result.release_set.releaseSetId } });
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
      void releaseSetsQuery.refetch();
      void environmentsQuery.refetch();
      void environmentStateQuery.refetch();
      void releasesQuery.refetch();
    }
  }, [refreshSignal]);

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

  const releaseSets = releaseSetsQuery.data ?? [];
  const filteredDeploysets = useMemo(() => {
    const normalizedSearch = (externalSearch ?? search).trim().toLowerCase();

    return releaseSets.filter((releaseSet) => {
      if (releaseSetFilter !== "all" && releaseSet.releaseSetId !== releaseSetFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [releaseSet.releaseSetId, releaseSet.releaseSetId, releaseSet.createdBy, tagSummary(releaseSet.tags)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [releaseSetFilter, releaseSets, externalSearch, search]);

  if (releaseSetsQuery.isLoading) {
    return <LoadingPanel label="Loading releaseSets..." />;
  }

  if (releaseSetsQuery.error) {
    return <ApiErrorPanel error={releaseSetsQuery.error} onRetry={() => releaseSetsQuery.refetch()} />;
  }

  const drawer = drawerMounted ? (
    <CreateReleaseSetDrawer
      open={drawerEntered}
      releaseSets={releaseSetsQuery.data ?? []}
      environments={environmentsQuery.data ?? []}
      environmentState={environmentStateQuery.data ?? []}
      releases={releasesQuery.data ?? []}
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
            <h1 className="text-[28px] font-bold tracking-normal text-slate-950">ReleaseSets</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Immutable desired component-version sets ready for deployment.</p>
          </div>
          <Button className="px-4" onClick={openDrawer}>
            <Plus className="h-5 w-5" />
            Create ReleaseSet
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
          <Select variant="light" value={releaseSetFilter} onChange={(event) => setReleaseSetFilter(event.target.value)} className="w-[220px]">
            <option value="all">ReleaseSet: All</option>
            {(releaseSetsQuery.data ?? []).map((releaseSet) => (
              <option key={releaseSet.releaseSetId} value={releaseSet.releaseSetId}>
                {releaseSet.releaseSetId}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={() => releaseSetsQuery.refetch()}>
          Refresh
        </Button>
      </div> : null}

      {embedded ? (
        <div className="relative">
          {refreshing ? <LoadingOverlay /> : null}
          {filteredDeploysets.length ? (
            <ScrollFade className="flex-1 rounded-t-lg">
              <DeploysetsTable rows={filteredDeploysets} />
            </ScrollFade>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyPanel label="No ReleaseSets match the current filters." />
            </div>
          )}
        </div>
      ) : (
        <Card className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
            {refreshing ? <LoadingOverlay /> : null}
            {filteredDeploysets.length ? (
              <ScrollFade className="flex-1 rounded-t-lg">
                <DeploysetsTable rows={filteredDeploysets} />
              </ScrollFade>
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <EmptyPanel label="No ReleaseSets match the current filters." />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {drawer}
    </div>
  );
}

function DeploysetsTable({ rows }: { rows: ApiReleaseSet[] }) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-white">
        <TableRow>
          <TableHead>ReleaseSet</TableHead>
          <TableHead>Components</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((releaseSet) => (
          <TableRow key={releaseSet.releaseSetId} className="hover:bg-blue-50/40">
            <TableCell>
              <EntityLink
                kind="releaseSet"
                to="/release-sets/$releaseSetId"
                params={{ releaseSetId: releaseSet.releaseSetId }}
              >
                {releaseSet.releaseSetId}
              </EntityLink>
            </TableCell>
            <TableCell>
              {releaseSet.items.map((item) => item.componentId).join(", ")}
            </TableCell>
            <TableCell>{releaseSet.createdBy}</TableCell>
            <TableCell>{formatRelativeTime(releaseSet.createdAt, { mode: "short" })}</TableCell>
            <TableCell>
              <TagList tags={releaseSet.tags} limit={3} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateReleaseSetDrawer({
  open,
  releaseSets,
  environments,
  environmentState,
  releases,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  releaseSets: ApiReleaseSet[];
  environments: { environmentId: string }[];
  environmentState: ApiEnvironmentState[];
  releases: ApiRelease[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (request: ApiReleaseSetCreateRequest) => void;
}) {
  const [form, setForm] = useState<ReleaseSetFormState>(() => defaultForm());
  const selectedReleaseSet = useMemo(
    () => releaseSets.find((releaseSet) => releaseSet.releaseSetId === form.releaseSetId),
    [releaseSets, form.releaseSetId],
  );
  const componentIds = useMemo(() => selectedReleaseSet?.items?.map((item) => item.componentId) ?? [], [selectedReleaseSet]);
  const releaseSetById = useMemo(() => new Map(releaseSets.map((releaseSet) => [releaseSet.releaseSetId, releaseSet])), [releaseSets]);
  const environmentStateById = useMemo(() => new Map(environmentState.map((state) => [state.environmentId, state])), [environmentState]);
  const releasesByComponent = useMemo(() => {
    const grouped = new Map<string, ApiRelease[]>();

    for (const release of releases) {
      grouped.set(release.componentId, [...(grouped.get(release.componentId) ?? []), release]);
    }

    for (const [componentId, componentReleases] of grouped) {
      grouped.set(
        componentId,
        [...componentReleases].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      );
    }

    return grouped;
  }, [releases]);
  const resolvedBaseReleaseSet = useMemo(() => {
    if (form.baseReleaseSetId) {
      return releaseSetById.get(form.baseReleaseSetId);
    }

    const state = form.baseEnvironmentId ? environmentStateById.get(form.baseEnvironmentId) : undefined;
    return state?.releaseSetId ? releaseSetById.get(state.releaseSetId) : undefined;
  }, [releaseSetById, environmentStateById, form.baseReleaseSetId, form.baseEnvironmentId]);
  const baseSourceLabel = form.baseReleaseSetId || (form.baseEnvironmentId ? `${form.baseEnvironmentId} current state` : "");

  const errors = validateForm(form);
  const canSubmit = Boolean(form.releaseSetId.trim()) && Object.keys(errors).length === 0 && !pending;
  const parsedTags = tagsToRecord(form.tags);

  useEffect(() => {
    if (!form.releaseSetId && releaseSets[0]?.releaseSetId) {
      setForm((current) => ({ ...current, releaseSetId: releaseSets[0].releaseSetId }));
    }
  }, [releaseSets, form.releaseSetId]);

  useEffect(() => {
    setForm((current) => {
      const existingByComponent = new Map(current.items.map((item) => [item.componentId, item]));
      const nextItems = componentIds.map((componentId) => {
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
  }, [componentIds]);

  const updateItemVersion = (id: string, version: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, version } : item)),
    }));
  };

  const useBaseForItems = () => {
    if (!resolvedBaseReleaseSet) {
      return;
    }

    const baseItemByComponent = new Map(resolvedBaseReleaseSet.items.map((item) => [item.componentId, item]));

    setForm((current) => ({
      ...current,
      releaseSetId: current.releaseSetId || resolvedBaseReleaseSet.releaseSetId,
      items: current.items.length
        ? current.items.map((item) => ({
            ...item,
            version: baseItemByComponent.get(item.componentId)?.version ?? item.version,
          }))
        : resolvedBaseReleaseSet.items.map((item) => draftItem(item.componentId, item.version)),
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
      releaseSetId: form.releaseSetId,
      baseEnvironmentId: form.baseEnvironmentId || null,
      baseReleaseSetId: form.baseReleaseSetId || null,
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
        aria-label="Close ReleaseSet creator"
        className={`absolute inset-0 z-0 bg-slate-950/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 z-10 flex h-full w-full max-w-[860px] transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Create ReleaseSet"
      >
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Create ReleaseSet</h2>
            <p className="mt-1 text-sm text-slate-600">Compose an immutable desired state from pinned component versions.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close ReleaseSet creator">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-5">
          <ScrollFade className="h-full rounded-lg" contentClassName="space-y-4 pr-1">
            <SectionCard title="Identity" description="Name the ReleaseSet and attach it to the release set it satisfies.">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="ReleaseSet ID" required>
                  <Input value={form.releaseSetId} onChange={(event) => setForm({ ...form, releaseSetId: event.target.value })} placeholder="webstack-prod-v6" />
                </Field>
                <Field label="ReleaseSet" required error={errors.releaseSetId}>
                  <Select variant="light" value={form.releaseSetId} onChange={(event) => setForm({ ...form, releaseSetId: event.target.value })}>
                    <option value="">Select release set</option>
                    {releaseSets.map((releaseSet) => (
                      <option key={releaseSet.releaseSetId} value={releaseSet.releaseSetId}>
                        {releaseSet.releaseSetId}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Components"
              required
              description="Choose one source to derive context from, then set the desired versions for this release set."
              action={
                <Button type="button" variant="outline" disabled={!resolvedBaseReleaseSet} onClick={useBaseForItems}>
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
                    onChange={(event) => setForm({ ...form, baseEnvironmentId: event.target.value, baseReleaseSetId: "" })}
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
                  Base ReleaseSet
                  <Select
                    variant="light"
                    value={form.baseReleaseSetId}
                    onChange={(event) => setForm({ ...form, baseReleaseSetId: event.target.value, baseEnvironmentId: "" })}
                  >
                    <option value=""></option>
                    {releaseSets.map((releaseSet) => (
                      <option key={releaseSet.releaseSetId} value={releaseSet.releaseSetId}>
                        {releaseSet.releaseSetId}
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
                            {versionOptionsForComponent(item.componentId, item.version, releasesByComponent).map((version) => (
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
              {!form.items.length ? <p className="mt-3 text-xs font-medium text-slate-500">Select a release set to choose versions.</p> : null}
              {errors.items ? <InlineFormError message={errors.items} /> : null}
            </SectionCard>

            <TagsCard
              tags={form.tags}
              error={errors.tags}
              resourceType="release-set"
              onReplace={(tags) => setForm((current) => ({ ...current, tags }))}
              onAdd={() => setForm((current) => ({ ...current, tags: [...current.tags, createTagDraft()] }))}
              onChange={updateTag}
              onRemove={removeTag}
            />

            <NotesCard
              value={form.notes}
              onChange={(notes) => setForm((current) => ({ ...current, notes }))}
              description="Capture why this ReleaseSet was created, approval context, or rollout intent."
              placeholder="Why this ReleaseSet was created, approval context, rollout intent..."
            />

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-normal text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error instanceof Error ? error.message : "Unable to create ReleaseSet."}
              </div>
            ) : null}
          </ScrollFade>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-slate-500">
            ReleaseSets are immutable after creation, so double-check component versions before saving.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={submit}>
              <CheckCheck className="h-4 w-4" />
              Create ReleaseSet
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

function versionOptionsForComponent(componentId: string, currentVersion: string, releasesByComponent: Map<string, ApiRelease[]>) {
  const versions = releasesByComponent.get(componentId)?.map((release) => release.version) ?? [];
  return Array.from(new Set([currentVersion, ...versions].filter(Boolean)));
}

function validateForm(form: ReleaseSetFormState) {
  const errors: Partial<Record<keyof ReleaseSetFormState, string>> = {};

  if (!form.releaseSetId) {
    errors.releaseSetId = "Choose a release set.";
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

