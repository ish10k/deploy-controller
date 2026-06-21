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
  createPublisher,
  getPublisher,
  listComponents,
  listReleases,
  listPublishers,
  putPublisher,
  queryKeys,
  rotatePublisherToken,
  type ApiComponent,
  type ApiRelease,
  type ApiPublisher,
  type ApiPublisherCreateRequest,
  type ApiRotateTokenResult,
} from "@/lib/api-client";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { canManagePublishers } from "@/lib/user-permissions";

export function PublishersPage() {
  const auth = useAuth();
  const canManage = canManagePublishers(auth.user);
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.publishers, queryFn: listPublishers });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const refreshing = useMinimumVisible(query.isFetching && !query.isLoading);
  const mutation = useMutation({
    mutationFn: createPublisher,
    onSuccess: async (result) => {
      setOpen(false);
      toast({
        title: "Publisher created",
        description: <IssuedTokenToast credential={{ id: result.publisher.publisherId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publishers });
      await navigate({ to: "/publishers/$publisherId", params: { publisherId: result.publisher.publisherId } });
    },
  });

  const publishers = query.data ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredPublishers = useMemo(
    () =>
      publishers.filter((publisher) =>
        [publisher.publisherId, publisher.displayName, publisher.principalId, publisher.tokenPrefix ?? "", ...Object.entries(publisher.tags ?? {}).flat()]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    [normalizedSearch, publishers],
  );

  return (
    <>
      <PageHeader
        title="Release Publishers"
        subtitle="External publishers that can create component releases within an explicit scope."
        action={
          canManage ? (
            <Button className="px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Publisher
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
            placeholder="Search publishers..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingPanel label="Loading publishers..." />
      ) : query.error ? (
        <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />
      ) : publishers.length ? (
        <Card className="relative mt-4 overflow-hidden">
          <CardContent className="p-3">
            {refreshing ? <LoadingOverlay /> : null}
            {filteredPublishers.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPublishers.map((publisher) => (
                    <TableRow key={publisher.publisherId} className="hover:bg-slate-50">
                      <TableCell>
                        <EntityLink
                          kind="publisher"
                          to="/publishers/$publisherId"
                          params={{ publisherId: publisher.publisherId }}
                        >
                          {publisher.publisherId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>{publisher.displayName}</TableCell>
                      <TableCell>
                        <EntityLink kind="user" to="/users/$principalId" params={{ principalId: publisher.principalId }}>
                          {publisher.principalId}
                        </EntityLink>
                      </TableCell>
                      <TableCell>
                        <Badge variant={publisher.active ? "green" : "slate"}>{publisher.active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>{scopeSummary(publisher)}</TableCell>
                      <TableCell>{formatRelativeTime(publisher.lastUsedAt, { mode: "short" })}</TableCell>
                      <TableCell>
                        <TagList tags={publisher.tags} limit={3} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyPanel label="No publishers match the current search." />
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyPanel label="No publishers found." />
      )}

      <PublisherDrawer
        components={componentsQuery.data ?? []}
        open={open}
        onClose={() => {
          setOpen(false);
          mutation.reset();
        }}
        onSubmit={(publisher) => mutation.mutate(publisher)}
        pending={mutation.isPending}
      />
    </>
  );
}

export function PublisherDetailsPage({ publisherId }: { publisherId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.publisher(publisherId),
    queryFn: async () => {
      const [publisher, components, releases] = await Promise.all([
        getPublisher(publisherId),
        listComponents(),
        listReleases(),
      ]);
      return { publisher, components, releases };
    },
    retry: 1,
  });
  if (query.isLoading) return <LoadingPanel label="Loading publisher details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.publisher) return <EmptyPanel label={`Publisher ${publisherId} was not found.`} />;

  return (
    <PublisherDetailsView
      publisher={query.data.publisher}
      components={query.data.components}
      releases={query.data.releases}
      onRefresh={() => query.refetch()}
      onInvalidate={async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.publisher(publisherId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.publishers }),
        ]);
      }}
    />
  );
}

function PublisherDetailsView({
  publisher,
  components,
  releases,
  onInvalidate,
  onRefresh,
}: {
  publisher: ApiPublisher;
  components: ApiComponent[];
  releases: ApiRelease[];
  onInvalidate: () => Promise<void>;
  onRefresh: () => Promise<unknown>;
}) {
  const auth = useAuth();
  const canManage = canManagePublishers(auth.user);
  const toast = useToast();
  const scopedReleases = useMemo(() => releases.filter((release) => publisherAllowsComponent(publisher, release.componentId)), [publisher, releases]);
  const rotateMutation = useMutation<ApiRotateTokenResult, Error, string>({
    mutationFn: rotatePublisherToken,
    onSuccess: async (result) => {
      toast({
        title: "Publisher token rotated",
        description: <IssuedTokenToast credential={{ id: publisher.publisherId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await onInvalidate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (next: ApiPublisher) => putPublisher(next.publisherId, next),
    onSuccess: async () => {
      toast({ title: "Publisher saved", variant: "success" });
      await onInvalidate();
    },
  });

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Release Publisher: ${publisher.displayName || publisher.publisherId}`}
        subtitle="Publisher identity, publishing scope, token state, and scoped releases."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void onRefresh()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            {canManage ? (
              <Button variant="outline" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate(publisher.publisherId)}>
                <RefreshCw className="h-4 w-4" />
                {rotateMutation.isPending ? "Rotating..." : "Rotate token"}
              </Button>
            ) : null}
            <Link to="/publishers">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to publishers
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4">
        <FactCard icon={Webhook} label="Status" value={publisher.active ? "Active" : "Inactive"} sublabel="Registration state" />
        <FactCard icon={ENTITY_ICONS.release} label="Scoped Releases" value={String(scopedReleases.length)} sublabel="Matching current scope" />
        <FactCard icon={KeyRound} label="Token Prefix" value={publisher.tokenPrefix ?? "None"} sublabel={publisher.tokenRotatedAt ? `Rotated ${formatRelativeTime(publisher.tokenRotatedAt, { mode: "short" })}` : "Not rotated"} />
        <FactCard icon={CalendarClock} label="Last Used" value={formatRelativeTime(publisher.lastUsedAt, { mode: "short" })} sublabel="Authentication activity" />
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
                <EmptyPanel label="No releases currently match this publisher scope." />
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
              <MetaRow icon={Webhook} label="Publisher" value={publisher.publisherId} />
              <MetaRow
                icon={UserRound}
                label="Principal"
                value={
                  <EntityLink kind="user" to="/users/$principalId" params={{ principalId: publisher.principalId }}>
                    {publisher.principalId}
                  </EntityLink>
                }
              />
              <MetaRow icon={KeyRound} label="Auth method" value={publisher.authMethod} />
              <MetaRow icon={KeyRound} label="Token prefix" value={publisher.tokenPrefix ?? "None"} />
              <MetaRow icon={CalendarClock} label="Token created" value={formatDateTime(publisher.tokenCreatedAt)} />
              <MetaRow icon={CalendarClock} label="Token rotated" value={formatDateTime(publisher.tokenRotatedAt)} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(publisher.createdAt)} />
              <MetaRow icon={UserRound} label="Created by" value={publisher.createdBy} />
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={publisher.tags} emptyLabel="No tags" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <ScopeList title="Components" values={publisher.scope?.componentIds ?? []} kind="component" emptyLabel="All components" />
            </CardContent>
          </Card>

          <PublisherSettings
            publisher={publisher}
            components={components}
            canManage={canManage}
            pending={updateMutation.isPending}
            onSubmit={(next) => updateMutation.mutate(next)}
          />
        </div>
      </div>
    </div>
  );
}

function PublisherDrawer({
  components,
  open,
  onClose,
  onSubmit,
  pending,
}: {
  components: ApiComponent[];
  open: boolean;
  onClose: () => void;
  onSubmit: (publisher: ApiPublisherCreateRequest) => void;
  pending: boolean;
}) {
  const [publisherId, setPublisherId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [active, setActive] = useState(true);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const tagsError = validateTagDrafts(tags);
  const trimmedPublisherId = publisherId.trim();
  const trimmedDisplayName = displayName.trim();

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };
  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort());
  };
  const submit = () => {
    if (!trimmedPublisherId || !trimmedDisplayName || tagsError) {
      return;
    }

    onSubmit({
      publisherId: trimmedPublisherId,
      displayName: trimmedDisplayName,
      active,
      scope: { componentIds },
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create publisher"
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
            <Button disabled={pending || !trimmedPublisherId || !trimmedDisplayName || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create publisher"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <p className="mt-1 text-sm text-slate-500">Use a stable publisher ID. Settle creates the backing service principal and PAT automatically.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Publisher ID
              <RequiredMark />
              <Input className="mt-1" value={publisherId} onChange={(event) => setPublisherId(event.target.value)} placeholder="platform-ci" />
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
          <p className="mt-1 text-sm text-slate-500">Choose allowed components. Leave the list empty to allow all components.</p>
          <div className="mt-4 grid gap-5">
            <CheckboxGroup
              title="Components"
              emptyLabel="No components registered."
              values={components.map((component) => component.componentId)}
              selected={componentIds}
              onToggle={(value) => toggleValue(value, componentIds, setComponentIds)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active publisher</span>
              <span>Active publishers can authenticate and publish releases within their scope.</span>
            </span>
          </label>
        </section>

        <TagsCard
          tags={tags}
          error={tagsError}
          resourceType="publisher"
          onReplace={setTags}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

function PublisherSettings({
  publisher,
  components,
  canManage,
  pending,
  onSubmit,
}: {
  publisher: ApiPublisher;
  components: ApiComponent[];
  canManage: boolean;
  pending: boolean;
  onSubmit: (publisher: ApiPublisher) => void;
}) {
  const [displayName, setDisplayName] = useState(publisher.displayName);
  const [active, setActive] = useState(publisher.active);
  const [componentIds, setComponentIds] = useState<string[]>(publisher.scope?.componentIds ?? []);
  const [tags, setTags] = useState<TagDraft[]>(recordToDrafts(publisher.tags ?? {}));
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    setDisplayName(publisher.displayName);
    setActive(publisher.active);
    setComponentIds(publisher.scope?.componentIds ?? []);
    setTags(recordToDrafts(publisher.tags ?? {}));
  }, [publisher]);

  const parsedTags = tagsToRecord(tags);
  const changed =
    displayName !== publisher.displayName ||
    active !== publisher.active ||
    componentIds.join("\n") !== (publisher.scope?.componentIds ?? []).join("\n") ||
    JSON.stringify(parsedTags) !== JSON.stringify(publisher.tags ?? {});

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
      ...publisher,
      displayName: displayName.trim(),
      active,
      scope: { componentIds },
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
            <span className="block font-medium text-slate-800">Active publisher</span>
            <span>Inactive publishers cannot publish releases.</span>
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
        </div>
        <TagsCard
          tags={tags}
          error={tagsError}
          disabled={!canManage}
          resourceType="publisher"
          onReplace={setTags}
          description="Operational labels for this publisher."
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
        <div className="mt-auto flex justify-end border-t border-slate-200 pt-4">
          <Button disabled={!canManage || !changed || pending || !displayName.trim() || Boolean(tagsError)} onClick={submit}>
            {pending ? "Saving..." : "Save publisher"}
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

function ScopeList({ title, values, kind, emptyLabel }: { title: string; values: string[]; kind: "component" | "releaseSet"; emptyLabel: string }) {
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
              <EntityLink key={value} kind="releaseSet" to="/release-sets/$releaseSetId" params={{ releaseSetId: value }}>
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

function scopeSummary(publisher: ApiPublisher) {
  const componentCount = publisher.scope?.componentIds?.length ?? 0;
  if (!componentCount) {
    return "All components";
  }
  return `${componentCount} components`;
}

function publisherAllowsComponent(publisher: ApiPublisher, componentId: string) {
  if (!publisher.scope?.componentIds?.length) {
    return true;
  }
  if (publisher.scope.componentIds.includes(componentId)) {
    return true;
  }
  return false;
}

function recordToDrafts(record: Record<string, string>) {
  const drafts = Object.entries(record).map(([key, value]) => createTagDraft(key, value));
  return drafts.length ? [...drafts, createTagDraft()] : [createTagDraft()];
}

