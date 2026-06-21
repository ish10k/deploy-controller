import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Clock3, KeyRound, Plus, Radio, RefreshCw, RefreshCcw, Server, Tag, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, PageHeader, useMinimumVisible } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { IssuedTokenToast } from "@/components/ui/issued-token-toast";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";
import {
  createDeploymentRunner,
  listComponents,
  getDeploymentRunner,
  listDeploymentRunners,
  listDeploymentRunnerItems,
  queryKeys,
  rotateDeploymentRunnerToken,
  type ApiDeploymentItem,
  type ApiDeploymentRunner,
  type ApiDeploymentRunnerCreateRequest,
  type ApiRotateTokenResult,
} from "@/lib/api-client";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

export function DeploymentRunnersPage() {
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.deploymentRunners, queryFn: listDeploymentRunners });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const componentTypes = [...new Set((componentsQuery.data ?? []).map((component) => component.type).filter((type): type is string => Boolean(type)))].sort();
  const refreshing = useMinimumVisible(query.isFetching && !query.isLoading);
  const mutation = useMutation({
    mutationFn: createDeploymentRunner,
    onSuccess: async (result) => {
      setOpen(false);
      toast({
        title: "Deployment runner created",
        description: <IssuedTokenToast credential={{ id: result.runner.runnerId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.deploymentRunners });
      await navigate({ to: "/deployment-runners/$runnerId", params: { runnerId: result.runner.runnerId } });
    },
  });

  if (query.isLoading) return <LoadingPanel label="Loading deployment runners..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;

  return (
    <>
      <PageHeader
        title="Deployment Runners"
        subtitle="Registered external executors that claim and report deployment work."
        action={
          <Button
            className="h-10 px-4"
            onClick={() => {
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Deployment Runner
          </Button>
        }
      />
      <Card className="relative mt-4 overflow-hidden">
        <CardContent className="p-3">
          {refreshing ? <LoadingOverlay /> : null}
          {query.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Runner</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Last Heartbeat</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((runner) => (
                  <TableRow key={runner.runnerId} className="hover:bg-slate-50">
                    <TableCell>
                      <EntityLink
                        kind="runner"
                        to="/deployment-runners/$runnerId"
                        params={{ runnerId: runner.runnerId }}
                      >
                        {runner.runnerId}
                      </EntityLink>
                    </TableCell>
                    <TableCell>{runner.displayName}</TableCell>
                    <TableCell>{runner.principalId}</TableCell>
                    <TableCell>
                      <Badge variant={runner.active ? "green" : "slate"}>{runner.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>{scopeSummary(runner)}</TableCell>
                    <TableCell>{formatRelativeTime(runner.lastHeartbeatAt, { mode: "short" })}</TableCell>
                    <TableCell>
                      <TagList tags={runner.tags} limit={3} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyPanel label="No deployment runners found." />
          )}
        </CardContent>
      </Card>
      <DeploymentRunnerDrawer
        typeOptions={componentTypes}
        open={open}
        onClose={() => {
          setOpen(false);
          mutation.reset();
        }}
        onSubmit={(runner) => mutation.mutate(runner)}
        pending={mutation.isPending}
      />
    </>
  );
}

function DeploymentRunnerDrawer({
  typeOptions,
  open,
  onClose,
  onSubmit,
  pending,
}: {
  typeOptions: string[];
  open: boolean;
  onClose: () => void;
  onSubmit: (runner: ApiDeploymentRunnerCreateRequest) => void;
  pending: boolean;
}) {
  const [runnerId, setRunnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [webhookId, setWebhookId] = useState("");
  const [active, setActive] = useState(true);
  const [componentTypes, setComponentTypes] = useState<string[]>([]);
  const [maxConcurrentClaims, setMaxConcurrentClaims] = useState(1);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const tagsError = validateTagDrafts(tags);
  const trimmedRunnerId = runnerId.trim();
  const trimmedDisplayName = displayName.trim();

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const submit = () => {
    if (!trimmedRunnerId || !trimmedDisplayName || tagsError) {
      return;
    }

    onSubmit({
      runnerId: trimmedRunnerId,
      displayName: trimmedDisplayName,
      active,
      scope: {
        environmentIds: [],
        componentIds: [],
        componentTypes,
        componentTags: {},
        environmentTags: {},
        maxConcurrentClaims,
      },
      webhookId: webhookId.trim() || null,
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create deployment runner"
      description="Register an external executor that can claim and report deployment work within an explicit scope."
      maxWidth="max-w-[820px]"
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">Provider-specific details stay in the runner process, not the control plane.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedRunnerId || !trimmedDisplayName || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create runner"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <p className="mt-1 text-sm text-slate-500">Use a stable runner ID. Settle creates the backing service principal and PAT automatically.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Runner ID
              <RequiredMark />
              <Input className="mt-1" value={runnerId} onChange={(event) => setRunnerId(event.target.value)} placeholder="aws-prod-platform-runner" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="AWS Prod Platform Runner" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Scope</h3>
          <p className="mt-1 text-sm text-slate-500">Choose the component types this runner can claim. Leave it empty to allow any type.</p>
          <div className="mt-4 space-y-4">
            <ScopeSelector
              title="Component Types"
              emptyLabel={typeOptions.length ? "Any" : "No component types available"}
              values={typeOptions}
              selected={componentTypes}
              onToggle={(value) => toggleValue(value, componentTypes, setComponentTypes)}
            />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Max concurrent claims
              <Input
                type="number"
                min={1}
                className="w-32"
                value={maxConcurrentClaims}
                onChange={(event) => setMaxConcurrentClaims(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Runtime metadata</h3>
          <p className="mt-1 text-sm text-slate-500">Only store identity and callback references here. Provider-specific config belongs in the runner.</p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Webhook ID
              <Input className="mt-1" value={webhookId} onChange={(event) => setWebhookId(event.target.value)} placeholder="wh_aws_prod_runner" />
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>
                <span className="block font-medium text-slate-800">Active runner</span>
                <span>Active runners can see scoped pending executions and report deployment status.</span>
              </span>
            </label>
          </div>
        </section>

        <TagsCard
          tags={tags}
          error={tagsError}
          resourceType="deployment-runner"
          onReplace={setTags}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

function ScopeSelector({
  title,
  emptyLabel,
  values,
  selected,
  onToggle,
}: {
  title: string;
  emptyLabel: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div>
      {values.length ? (
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {values.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input className="h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
              <span>{value}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="px-0 py-1 text-sm text-slate-500">{emptyLabel}</div>
      )}
      {selected.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <ScopeChip key={value}>{value}</ScopeChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DeploymentRunnerDetailsPage({ runnerId }: { runnerId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...queryKeys.deploymentRunners, runnerId],
    queryFn: async () => {
      const [runner, deploymentItems] = await Promise.all([getDeploymentRunner(runnerId), listDeploymentRunnerItems(runnerId)]);
      return { runner, deploymentItems };
    },
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading deployment runner details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.runner) return <EmptyPanel label={`Deployment runner ${runnerId} was not found.`} />;

  return (
    <DeploymentRunnerDetailsView
      runner={query.data.runner}
      deploymentItems={query.data.deploymentItems}
      onInvalidate={async () => {
        await queryClient.invalidateQueries({ queryKey: [...queryKeys.deploymentRunners, runnerId] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.deploymentRunners });
      }}
    />
  );
}

function DeploymentRunnerDetailsView({
  runner,
  deploymentItems,
  onInvalidate,
}: {
  runner: ApiDeploymentRunner;
  deploymentItems: ApiDeploymentItem[];
  onInvalidate: () => Promise<void>;
}) {
  const toast = useToast();
  const rotateMutation = useMutation<ApiRotateTokenResult, Error, string>({
    mutationFn: rotateDeploymentRunnerToken,
    onSuccess: async (result) => {
      toast({
        title: "Deployment runner token rotated",
        description: <IssuedTokenToast credential={{ id: runner.runnerId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await onInvalidate();
    },
  });
  const scope = {
    environmentIds: runner.scope?.environmentIds ?? [],
    componentIds: runner.scope?.componentIds ?? [],
    componentTypes: runner.scope?.componentTypes ?? [],
    componentTags: runner.scope?.componentTags ?? {},
    environmentTags: runner.scope?.environmentTags ?? {},
    maxConcurrentClaims: runner.scope?.maxConcurrentClaims ?? 1,
  };

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Deployment Runner: ${runner.runnerId}`}
        subtitle="Deployment runner identity, scope, heartbeat, and deployment items."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void onInvalidate()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate(runner.runnerId)}>
              <RefreshCw className="h-4 w-4" />
              {rotateMutation.isPending ? "Rotating..." : "Rotate token"}
            </Button>
            <Link to="/deployment-runners">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to deployment runners
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4">
        <FactCard icon={Radio} label="Status" value={runner.active ? "Active" : "Inactive"} sublabel="Registration state" />
        <FactCard icon={Server} label="Deployment Items" value={String(deploymentItems.length)} sublabel="Historical and current" />
        <FactCard icon={Clock3} label="Last Heartbeat" value={formatRelativeTime(runner.lastHeartbeatAt, { mode: "short" })} sublabel="Runner-reported timestamp" />
        <FactCard icon={KeyRound} label="Token Prefix" value={runner.tokenPrefix ?? "None"} sublabel={runner.tokenRotatedAt ? `Rotated ${formatRelativeTime(runner.tokenRotatedAt, { mode: "short" })}` : "Not rotated"} />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Deployment items</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {deploymentItems.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Execution</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deploymentItems.map((item) => (
                      <TableRow key={`${item.deploymentId}:${item.componentId}`}>
                        <TableCell>
                          <EntityLink
                            kind="deployment"
                            to="/deployments/$deploymentId"
                            params={{ deploymentId: item.deploymentId }}
                          >
                            {item.deploymentId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink kind="component" to="/components/$componentId" params={{ componentId: item.componentId }}>
                            {item.componentId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: item.environmentId }}>
                            {item.environmentId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink
                            kind="release"
                            to="/releases/$componentId/$version"
                            params={{ componentId: item.componentId, version: item.version }}
                          >
                            {item.version}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>{formatRelativeTime(item.claimedAt, { mode: "short" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No deployment items are currently in scope for this runner." />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Runner metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={Server} label="Runner" value={runner.runnerId} />
              <MetaRow icon={KeyRound} label="Principal" value={runner.principalId} />
              <MetaRow icon={KeyRound} label="Auth method" value={runner.authMethod} />
              <MetaRow icon={KeyRound} label="Token prefix" value={runner.tokenPrefix ?? "None"} />
              <MetaRow icon={CalendarClock} label="Token created" value={formatDateTime(runner.tokenCreatedAt)} />
              <MetaRow icon={CalendarClock} label="Token rotated" value={formatDateTime(runner.tokenRotatedAt)} />
              <MetaRow icon={Clock3} label="Last used" value={formatRelativeTime(runner.lastUsedAt, { mode: "short" })} />
              <MetaRow icon={UserRound} label="Display Name" value={runner.displayName} />
              <MetaRow icon={Server} label="Webhook" value={runner.webhookId ?? "None"} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(runner.createdAt)} />
              <MetaRow icon={UserRound} label="Created by" value={runner.createdBy} />
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={runner.tags} emptyLabel="No tags" />
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
              <ScrollFade className="h-full" contentClassName="grid gap-4 px-4 pb-4 text-sm">
                <ScopeList title="Environments" values={scope.environmentIds} />
                <ScopeList title="Components" values={scope.componentIds} />
                <ScopeList title="Component Types" values={scope.componentTypes} />
                <ScopeTagList title="Component Tags" tags={scope.componentTags} />
                <ScopeTagList title="Environment Tags" tags={scope.environmentTags} />
                <ScopeStat title="Max concurrent claims" value={scope.maxConcurrentClaims} />
              </ScrollFade>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function scopeSummary(runner: ApiDeploymentRunner) {
  const scope = {
    environmentIds: runner.scope?.environmentIds ?? [],
    componentIds: runner.scope?.componentIds ?? [],
    componentTypes: runner.scope?.componentTypes ?? [],
    componentTags: runner.scope?.componentTags ?? {},
    environmentTags: runner.scope?.environmentTags ?? {},
    maxConcurrentClaims: runner.scope?.maxConcurrentClaims ?? 1,
  };
  const environmentCount = scope.environmentIds.length;
  const componentCount = scope.componentIds.length;
  const componentTypeCount = scope.componentTypes.length;
  const componentTagCount = Object.keys(scope.componentTags).length;
  const environmentTagCount = Object.keys(scope.environmentTags).length;
  if (!environmentCount && !componentCount && !componentTypeCount && !componentTagCount && !environmentTagCount) {
    return "All deployment work";
  }
  return `${environmentCount || "All"} env / ${componentCount || "All"} components / ${componentTypeCount || "All"} types`;
}

function ScopeList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <ScopeChip key={value}>{value}</ScopeChip>
          ))}
        </div>
      ) : (
        <span className="text-slate-500">Any</span>
      )}
    </div>
  );
}

function ScopeTagList({ title, tags }: { title: string; tags: Record<string, string> }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      {Object.entries(tags).length ? (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(tags).map(([key, value]) => (
            <ScopeChip key={key}>
              {key}
              {value ? <span className="text-slate-400">:{value}</span> : null}
            </ScopeChip>
          ))}
        </div>
      ) : (
        <span className="text-slate-500">Any</span>
      )}
    </div>
  );
}

function ScopeStat({ title, value }: { title: string; value: number }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      <ScopeChip>{value}</ScopeChip>
    </div>
  );
}

function ScopeChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">{children}</span>;
}

function FactCard({ icon: Icon, label, value, sublabel }: { icon: typeof Server; label: string; value: ReactNode; sublabel: string }) {
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

function MetaRow({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: ReactNode }) {
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

