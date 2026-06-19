import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, KeyRound, Plus, RefreshCw, RefreshCcw, Search, Tag, UserRound, Webhook } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, PageHeader, useMinimumVisible } from "@/components/common/api-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { IssuedTokenToast } from "@/components/ui/issued-token-toast";
import { RequiredMark } from "@/components/ui/required-mark";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";
import { useAuth } from "@/lib/auth-context";
import {
  createReleaseSource,
  getReleaseSource,
  listComponentSets,
  listComponents,
  listReleases,
  listReleaseSources,
  putReleaseSource,
  queryKeys,
  rotateReleaseSourceToken,
  type ApiComponent,
  type ApiComponentSet,
  type ApiRelease,
  type ApiReleaseSource,
  type ApiReleaseSourceCreateRequest,
  type ApiRotateTokenResult,
} from "@/lib/api-client";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { canManageReleaseSources } from "@/lib/user-permissions";

export function ReleaseSourcesPage() {
  const auth = useAuth();
  const canManage = canManageReleaseSources(auth.user);
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.releaseSources, queryFn: listReleaseSources });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const componentSetsQuery = useQuery({ queryKey: queryKeys.componentSets, queryFn: listComponentSets });
  const refreshing = useMinimumVisible(query.isFetching && !query.isLoading);
  const mutation = useMutation({
    mutationFn: createReleaseSource,
    onSuccess: async (result) => {
      setOpen(false);
      toast({
        title: "Release source created",
        description: <IssuedTokenToast credential={{ id: result.releaseSource.releaseSourceId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.releaseSources });
      await navigate({ to: "/release-sources/$releaseSourceId", params: { releaseSourceId: result.releaseSource.releaseSourceId } });
    },
  });

  const releaseSources = query.data ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredReleaseSources = useMemo(
    () =>
      releaseSources.filter((source) =>
        [source.releaseSourceId, source.displayName, source.principalId, source.tokenPrefix ?? "", ...Object.entries(source.tags).flat()]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    [normalizedSearch, releaseSources],
  );

  return (
    <>
      <PageHeader
        title="Release Sources"
        subtitle="External publishers that can create component releases within an explicit scope."
        action={
          canManage ? (
            <Button className="px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Release Source
            </Button>
          ) : null
        }
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex h-10 w-[340px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search release sources..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingPanel label="Loading release sources..." />
      ) : query.error ? (
        <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />
      ) : releaseSources.length ? (
        <Card className="relative mt-4 overflow-hidden">
          <CardContent className="p-3">
            {refreshing ? <LoadingOverlay /> : null}
            {filteredReleaseSources.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Release Source</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReleaseSources.map((source) => (
                    <TableRow key={source.releaseSourceId} className="hover:bg-slate-50">
                      <TableCell>
                        <EntityLink
                          kind="releaseSource"
                          to="/release-sources/$releaseSourceId"
                          params={{ releaseSourceId: source.releaseSourceId }}
                        >
                          {source.releaseSourceId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>{source.displayName}</TableCell>
                      <TableCell>
                        <EntityLink kind="user" to="/users/$principalId" params={{ principalId: source.principalId }}>
                          {source.principalId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.active ? "green" : "slate"}>{source.active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>{scopeSummary(source)}</TableCell>
                      <TableCell>{formatRelativeTime(source.lastUsedAt, { mode: "short" })}</TableCell>
                      <TableCell>
                        <TagList tags={source.tags} limit={3} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyPanel label="No release sources match the current search." />
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyPanel label="No release sources found." />
      )}

      <ReleaseSourceDrawer
        components={componentsQuery.data ?? []}
        componentSets={componentSetsQuery.data ?? []}
        open={open}
        onClose={() => {
          setOpen(false);
          mutation.reset();
        }}
        onSubmit={(source) => mutation.mutate(source)}
        pending={mutation.isPending}
      />
    </>
  );
}

export function ReleaseSourceDetailsPage({ releaseSourceId }: { releaseSourceId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.releaseSource(releaseSourceId),
    queryFn: async () => {
      const [releaseSource, components, componentSets, releases] = await Promise.all([
        getReleaseSource(releaseSourceId),
        listComponents(),
        listComponentSets(),
        listReleases(),
      ]);
      return { releaseSource, components, componentSets, releases };
    },
    retry: 1,
  });
  if (query.isLoading) return <LoadingPanel label="Loading release source details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.releaseSource) return <EmptyPanel label={`Release source ${releaseSourceId} was not found.`} />;

  return (
    <ReleaseSourceDetailsView
      releaseSource={query.data.releaseSource}
      components={query.data.components}
      componentSets={query.data.componentSets}
      releases={query.data.releases}
      onRefresh={() => query.refetch()}
      onInvalidate={async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.releaseSource(releaseSourceId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.releaseSources }),
        ]);
      }}
    />
  );
}

function ReleaseSourceDetailsView({
  releaseSource,
  components,
  componentSets,
  releases,
  onInvalidate,
  onRefresh,
}: {
  releaseSource: ApiReleaseSource;
  components: ApiComponent[];
  componentSets: ApiComponentSet[];
  releases: ApiRelease[];
  onInvalidate: () => Promise<void>;
  onRefresh: () => Promise<unknown>;
}) {
  const auth = useAuth();
  const canManage = canManageReleaseSources(auth.user);
  const toast = useToast();
  const scopedReleases = useMemo(
    () => releases.filter((release) => releaseSourceAllowsComponent(releaseSource, release.componentId, componentSets)),
    [componentSets, releaseSource, releases],
  );
  const rotateMutation = useMutation<ApiRotateTokenResult, Error, string>({
    mutationFn: rotateReleaseSourceToken,
    onSuccess: async (result) => {
      toast({
        title: "Release source token rotated",
        description: <IssuedTokenToast credential={{ id: releaseSource.releaseSourceId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await onInvalidate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (next: ApiReleaseSource) => putReleaseSource(next.releaseSourceId, next),
    onSuccess: async () => {
      toast({ title: "Release source saved", variant: "success" });
      await onInvalidate();
    },
  });

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Release Source: ${releaseSource.displayName || releaseSource.releaseSourceId}`}
        subtitle="Release source identity, publishing scope, token state, and scoped releases."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void onRefresh()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            {canManage ? (
              <Button variant="outline" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate(releaseSource.releaseSourceId)}>
                <RefreshCw className="h-4 w-4" />
                {rotateMutation.isPending ? "Rotating..." : "Rotate token"}
              </Button>
            ) : null}
            <Link to="/release-sources">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to release sources
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4">
        <FactCard icon={Webhook} label="Status" value={releaseSource.active ? "Active" : "Inactive"} sublabel="Registration state" />
        <FactCard icon={ENTITY_ICONS.release} label="Scoped Releases" value={String(scopedReleases.length)} sublabel="Matching current scope" />
        <FactCard icon={KeyRound} label="Token Prefix" value={releaseSource.tokenPrefix ?? "None"} sublabel={releaseSource.tokenRotatedAt ? `Rotated ${formatRelativeTime(releaseSource.tokenRotatedAt, { mode: "short" })}` : "Not rotated"} />
        <FactCard icon={CalendarClock} label="Last Used" value={formatRelativeTime(releaseSource.lastUsedAt, { mode: "short" })} sublabel="Authentication activity" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Scoped releases</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {scopedReleases.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedReleases.map((release) => (
                      <TableRow key={`${release.componentId}:${release.version}`}>
                        <TableCell>
                          <EntityLink kind="component" to="/components/$componentId" params={{ componentId: release.componentId }}>
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
                        <TableCell>{formatDateTime(release.createdAt)}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{release.notes ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No releases currently match this release source scope." />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Source metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={Webhook} label="Source" value={releaseSource.releaseSourceId} />
              <MetaRow
                icon={UserRound}
                label="Principal"
                value={
                  <EntityLink kind="user" to="/users/$principalId" params={{ principalId: releaseSource.principalId }}>
                    {releaseSource.principalId}
                  </EntityLink>
                }
              />
              <MetaRow icon={KeyRound} label="Auth method" value={releaseSource.authMethod} />
              <MetaRow icon={KeyRound} label="Token prefix" value={releaseSource.tokenPrefix ?? "None"} />
              <MetaRow icon={CalendarClock} label="Token created" value={formatDateTime(releaseSource.tokenCreatedAt)} />
              <MetaRow icon={CalendarClock} label="Token rotated" value={formatDateTime(releaseSource.tokenRotatedAt)} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(releaseSource.createdAt)} />
              <MetaRow icon={UserRound} label="Created by" value={releaseSource.createdBy} />
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={releaseSource.tags} emptyLabel="No tags" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <ScopeList title="Components" values={releaseSource.scope.componentIds} kind="component" emptyLabel="All components" />
              <ScopeList title="Component Sets" values={releaseSource.scope.componentSetIds} kind="componentSet" emptyLabel="All component sets" />
            </CardContent>
          </Card>

          <ReleaseSourceSettings
            releaseSource={releaseSource}
            components={components}
            componentSets={componentSets}
            canManage={canManage}
            pending={updateMutation.isPending}
            onSubmit={(next) => updateMutation.mutate(next)}
          />
        </div>
      </div>
    </div>
  );
}

function ReleaseSourceDrawer({
  components,
  componentSets,
  open,
  onClose,
  onSubmit,
  pending,
}: {
  components: ApiComponent[];
  componentSets: ApiComponentSet[];
  open: boolean;
  onClose: () => void;
  onSubmit: (source: ApiReleaseSourceCreateRequest) => void;
  pending: boolean;
}) {
  const [releaseSourceId, setReleaseSourceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [active, setActive] = useState(true);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [componentSetIds, setComponentSetIds] = useState<string[]>([]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const tagsError = validateTagDrafts(tags);
  const trimmedReleaseSourceId = releaseSourceId.trim();
  const trimmedDisplayName = displayName.trim();

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };
  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort());
  };
  const submit = () => {
    if (!trimmedReleaseSourceId || !trimmedDisplayName || tagsError) {
      return;
    }

    onSubmit({
      releaseSourceId: trimmedReleaseSourceId,
      displayName: trimmedDisplayName,
      active,
      scope: { componentIds, componentSetIds },
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create release source"
      description="Register an external publisher and issue its initial PAT."
      maxWidth="max-w-[820px]"
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">The raw token is only displayed once after creation.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedReleaseSourceId || !trimmedDisplayName || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create release source"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <p className="mt-1 text-sm text-slate-500">Use a stable source ID. Settle creates the backing service principal and PAT automatically.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Source ID
              <RequiredMark />
              <Input className="mt-1" value={releaseSourceId} onChange={(event) => setReleaseSourceId(event.target.value)} placeholder="platform-ci" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Platform CI" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Publishing scope</h3>
          <p className="mt-1 text-sm text-slate-500">Choose allowed components and component sets. Leave both groups empty to allow all components.</p>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <CheckboxGroup
              title="Components"
              emptyLabel="No components registered."
              values={components.map((component) => component.componentId)}
              selected={componentIds}
              onToggle={(value) => toggleValue(value, componentIds, setComponentIds)}
            />
            <CheckboxGroup
              title="Component Sets"
              emptyLabel="No component sets registered."
              values={componentSets.map((componentSet) => componentSet.componentSetId)}
              selected={componentSetIds}
              onToggle={(value) => toggleValue(value, componentSetIds, setComponentSetIds)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active release source</span>
              <span>Active sources can authenticate and publish releases within their scope.</span>
            </span>
          </label>
        </section>

        <TagsCard
          tags={tags}
          error={tagsError}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

function ReleaseSourceSettings({
  releaseSource,
  components,
  componentSets,
  canManage,
  pending,
  onSubmit,
}: {
  releaseSource: ApiReleaseSource;
  components: ApiComponent[];
  componentSets: ApiComponentSet[];
  canManage: boolean;
  pending: boolean;
  onSubmit: (source: ApiReleaseSource) => void;
}) {
  const [displayName, setDisplayName] = useState(releaseSource.displayName);
  const [active, setActive] = useState(releaseSource.active);
  const [componentIds, setComponentIds] = useState<string[]>(releaseSource.scope.componentIds);
  const [componentSetIds, setComponentSetIds] = useState<string[]>(releaseSource.scope.componentSetIds);
  const [tags, setTags] = useState<TagDraft[]>(recordToDrafts(releaseSource.tags));
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    setDisplayName(releaseSource.displayName);
    setActive(releaseSource.active);
    setComponentIds(releaseSource.scope.componentIds);
    setComponentSetIds(releaseSource.scope.componentSetIds);
    setTags(recordToDrafts(releaseSource.tags));
  }, [releaseSource]);

  const parsedTags = tagsToRecord(tags);
  const changed =
    displayName !== releaseSource.displayName ||
    active !== releaseSource.active ||
    componentIds.join("\n") !== releaseSource.scope.componentIds.join("\n") ||
    componentSetIds.join("\n") !== releaseSource.scope.componentSetIds.join("\n") ||
    JSON.stringify(parsedTags) !== JSON.stringify(releaseSource.tags);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };
  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort());
  };
  const submit = () => {
    if (!canManage || !displayName.trim() || tagsError) {
      return;
    }
    onSubmit({
      ...releaseSource,
      displayName: displayName.trim(),
      active,
      scope: { componentIds, componentSetIds },
      tags: parsedTags,
    });
  };

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <Input disabled={!canManage} className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input disabled={!canManage} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>
            <span className="block font-medium text-slate-800">Active release source</span>
            <span>Inactive sources cannot publish releases.</span>
          </span>
        </label>
        <div className="grid gap-4">
          <CheckboxGroup
            title="Components"
            emptyLabel="No components registered."
            values={components.map((component) => component.componentId)}
            selected={componentIds}
            disabled={!canManage}
            onToggle={(value) => toggleValue(value, componentIds, setComponentIds)}
          />
          <CheckboxGroup
            title="Component Sets"
            emptyLabel="No component sets registered."
            values={componentSets.map((componentSet) => componentSet.componentSetId)}
            selected={componentSetIds}
            disabled={!canManage}
            onToggle={(value) => toggleValue(value, componentSetIds, setComponentSetIds)}
          />
        </div>
        <TagsCard
          tags={tags}
          error={tagsError}
          disabled={!canManage}
          description="Operational labels for this release source."
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
        <div className="mt-auto flex justify-end border-t border-slate-200 pt-4">
          <Button disabled={!canManage || !changed || pending || !displayName.trim() || Boolean(tagsError)} onClick={submit}>
            {pending ? "Saving..." : "Save release source"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckboxGroup({
  title,
  emptyLabel,
  values,
  selected,
  disabled = false,
  onToggle,
}: {
  title: string;
  emptyLabel: string;
  values: string[];
  selected: string[];
  disabled?: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div>
      {values.length ? (
        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {values.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                type="checkbox"
                checked={selected.includes(value)}
                disabled={disabled}
                onChange={() => onToggle(value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{emptyLabel}</div>
      )}
      <div className="mt-2 text-xs font-medium text-slate-500">{selected.length ? `${selected.length} selected` : "All allowed"}</div>
    </div>
  );
}

function ScopeList({ title, values, kind, emptyLabel }: { title: string; values: string[]; kind: "component" | "componentSet"; emptyLabel: string }) {
  return (
    <div>
      <div className="mb-2 font-semibold text-slate-700">{title}</div>
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) =>
            kind === "component" ? (
              <EntityLink key={value} kind="component" to="/components/$componentId" params={{ componentId: value }}>
                {value}
              </EntityLink>
            ) : (
              <EntityLink key={value} kind="componentSet" to="/component-sets/$componentSetId" params={{ componentSetId: value }}>
                {value}
              </EntityLink>
            ),
          )}
        </div>
      ) : (
        <span className="text-slate-500">{emptyLabel}</span>
      )}
    </div>
  );
}

function FactCard({ icon: Icon, label, value, sublabel }: { icon: LucideIcon; label: string; value: ReactNode; sublabel: string }) {
  return (
    <Card className="h-[116px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 truncate text-lg font-bold text-blue-700">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
      <span className="flex items-center gap-2 font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className="min-w-0 truncate text-slate-800">{value}</span>
    </div>
  );
}

function scopeSummary(source: ApiReleaseSource) {
  const componentCount = source.scope.componentIds.length;
  const componentSetCount = source.scope.componentSetIds.length;
  if (!componentCount && !componentSetCount) {
    return "All components";
  }
  return `${componentCount || "All"} components / ${componentSetCount || "All"} component sets`;
}

function releaseSourceAllowsComponent(source: ApiReleaseSource, componentId: string, componentSets: ApiComponentSet[]) {
  if (!source.scope.componentIds.length && !source.scope.componentSetIds.length) {
    return true;
  }
  if (source.scope.componentIds.includes(componentId)) {
    return true;
  }
  const scopedComponentIds = new Set(
    componentSets
      .filter((componentSet) => source.scope.componentSetIds.includes(componentSet.componentSetId))
      .flatMap((componentSet) => componentSet.components.map((component) => component.componentId)),
  );
  return scopedComponentIds.has(componentId);
}

function recordToDrafts(record: Record<string, string>) {
  const drafts = Object.entries(record).map(([key, value]) => createTagDraft(key, value));
  return drafts.length ? [...drafts, createTagDraft()] : [createTagDraft()];
}
