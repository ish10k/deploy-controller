import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CircleFadingArrowUp,
  Database,
  Edit3,
  ExternalLink,
  Copy,
  KeyRound,
  Layers3,
  LucideIcon,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Rocket,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import {
  createDeploymentRunner,
  createPrincipal,
  createReleaseSource,
  getBootstrapState,
  listComponentSets,
  listComponents,
  listDeploysets,
  listDeploymentExecutions,
  listDeploymentRunners,
  listEnvironments,
  listPrincipals,
  listReleases,
  listReleaseSources,
  putDeploymentRunner,
  putEnvironment,
  putPrincipal,
  putReleaseSource,
  queryKeys,
  rotateDeploymentRunnerToken,
  rotateReleaseSourceToken,
  type ApiRotateTokenResult,
  type ApiBootstrapState,
  type ApiComponent,
  type ApiComponentSet,
  type ApiDeploySet,
  type ApiDeploymentExecution,
  type ApiDeploymentRunner,
  type ApiDeploymentRunnerCreateRequest,
  type ApiDeploymentRunnerCreateResult,
  type ApiEnvironment,
  type ApiPrincipal,
  type ApiRelease,
  type ApiReleaseSource,
  type ApiReleaseSourceCreateRequest,
  type ApiReleaseSourceCreateResult,
} from "@/lib/api-client";
import { ADMIN_ROLES, buildAdminCapabilities } from "@/lib/admin-capabilities";
import { formatDateTime } from "@/lib/format";

type AdminSnapshot = {
  bootstrap: ApiBootstrapState;
  principals: ApiPrincipal[];
  deploymentRunners: ApiDeploymentRunner[];
  releaseSources: ApiReleaseSource[];
  environments: ApiEnvironment[];
  components: ApiComponent[];
  componentSets: ApiComponentSet[];
  deploysets: ApiDeploySet[];
  releases: ApiRelease[];
  deploymentExecutions: ApiDeploymentExecution[];
};

type PrincipalDrawerState =
  | { mode: "create"; principal: ApiPrincipal | null }
  | { mode: "edit"; principal: ApiPrincipal }
  | null;

type RunnerDrawerState =
  | { mode: "create"; runner: ApiDeploymentRunner | null }
  | { mode: "edit"; runner: ApiDeploymentRunner }
  | null;

type ReleaseSourceDrawerState =
  | { mode: "create"; releaseSource: ApiReleaseSource | null }
  | { mode: "edit"; releaseSource: ApiReleaseSource }
  | null;

type EnvironmentDrawerState =
  | { mode: "create"; environment: ApiEnvironment | null }
  | { mode: "edit"; environment: ApiEnvironment }
  | null;

const ROLE_OPTIONS = [
  { value: ADMIN_ROLES.platformAdmin, label: "Platform admin" },
  { value: ADMIN_ROLES.platformDeployer, label: "Platform deployer" },
  { value: ADMIN_ROLES.platformViewer, label: "Platform viewer" },
  { value: ADMIN_ROLES.deploymentRunner, label: "Deployment runner" },
  { value: ADMIN_ROLES.releaseSource, label: "Release source" },
] as const;

function loadAdminSnapshot(): Promise<AdminSnapshot> {
  return Promise.all([
    getBootstrapState(),
    listPrincipals(),
    listDeploymentRunners(),
    listReleaseSources(),
    listEnvironments(),
    listComponents(),
    listComponentSets(),
    listDeploysets(),
    listReleases(),
    listDeploymentExecutions(),
  ]).then(([bootstrap, principals, deploymentRunners, releaseSources, environments, components, componentSets, deploysets, releases, deploymentExecutions]) => ({
    bootstrap,
    principals,
    deploymentRunners,
    releaseSources,
    environments,
    components,
    componentSets,
    deploysets,
    releases,
    deploymentExecutions,
  }));
}

export function AdminPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const capabilities = buildAdminCapabilities(auth.user);
  const query = useQuery({
    queryKey: ["admin", "snapshot"],
    queryFn: loadAdminSnapshot,
    retry: 1,
  });
  const [principalDrawer, setPrincipalDrawer] = useState<PrincipalDrawerState>(null);
  const [runnerDrawer, setRunnerDrawer] = useState<RunnerDrawerState>(null);
  const [releaseSourceDrawer, setReleaseSourceDrawer] = useState<ReleaseSourceDrawerState>(null);
  const [environmentDrawer, setEnvironmentDrawer] = useState<EnvironmentDrawerState>(null);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "snapshot"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.principals }),
      queryClient.invalidateQueries({ queryKey: queryKeys.deploymentRunners }),
      queryClient.invalidateQueries({ queryKey: queryKeys.releaseSources }),
      queryClient.invalidateQueries({ queryKey: queryKeys.environments }),
      queryClient.invalidateQueries({ queryKey: queryKeys.components }),
      queryClient.invalidateQueries({ queryKey: queryKeys.componentSets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.deploysets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.releases() }),
    ]);
  };

  const principalMutation = useMutation({
    mutationFn: async (principal: ApiPrincipal) => {
      if (principalDrawer?.mode === "edit") {
        return putPrincipal(principalDrawer.principal.principalId, principal);
      }
      return createPrincipal(principal);
    },
    onSuccess: async () => {
      setPrincipalDrawer(null);
      toast({ title: "Principal saved", variant: "success" });
      await invalidateAll();
      await auth.refresh();
    },
  });

  const principalToggleMutation = useMutation({
    mutationFn: async (principal: ApiPrincipal) =>
      putPrincipal(principal.principalId, {
        ...principal,
        active: !principal.active,
      }),
    onSuccess: async () => {
      toast({ title: "Principal status updated", variant: "success" });
      await invalidateAll();
      await auth.refresh();
    },
  });

  const runnerMutation = useMutation<ApiDeploymentRunner | ApiDeploymentRunnerCreateResult, Error, ApiDeploymentRunner>({
    mutationFn: async (runner: ApiDeploymentRunner) => {
      if (runnerDrawer?.mode === "edit") {
        return putDeploymentRunner(runnerDrawer.runner.runnerId, runner);
      }
      const payload: ApiDeploymentRunnerCreateRequest = {
        runnerId: runner.runnerId,
        displayName: runner.displayName,
        active: runner.active,
        scope: runner.scope,
        webhookId: runner.webhookId,
        tags: runner.tags,
      };
      return createDeploymentRunner(payload);
    },
    onSuccess: async (result) => {
      setRunnerDrawer(null);
      if ("token" in result) {
        toast({
          title: "Deployment runner created",
          description: <IssuedTokenToast credential={{ id: result.runner.runnerId, token: result.token }} />,
          variant: "success",
          durationMs: 0,
        });
      } else {
        toast({ title: "Deployment runner saved", variant: "success" });
      }
      await invalidateAll();
    },
  });

  const runnerToggleMutation = useMutation({
    mutationFn: async (runner: ApiDeploymentRunner) =>
      putDeploymentRunner(runner.runnerId, {
        ...runner,
        active: !runner.active,
      }),
    onSuccess: async () => {
      toast({ title: "Deployment runner status updated", variant: "success" });
      await invalidateAll();
    },
  });

  const runnerTokenMutation = useMutation<ApiRotateTokenResult, Error, string>({
    mutationFn: rotateDeploymentRunnerToken,
    onSuccess: async (result, runnerId) => {
      toast({
        title: "Deployment runner token rotated",
        description: <IssuedTokenToast credential={{ id: runnerId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await invalidateAll();
    },
  });

  const releaseSourceMutation = useMutation<ApiReleaseSource | ApiReleaseSourceCreateResult, Error, ApiReleaseSource>({
    mutationFn: async (releaseSource: ApiReleaseSource) => {
      if (releaseSourceDrawer?.mode === "edit") {
        return putReleaseSource(releaseSourceDrawer.releaseSource.releaseSourceId, releaseSource);
      }
      const payload: ApiReleaseSourceCreateRequest = {
        releaseSourceId: releaseSource.releaseSourceId,
        displayName: releaseSource.displayName,
        active: releaseSource.active,
        scope: releaseSource.scope,
        tags: releaseSource.tags,
      };
      return createReleaseSource(payload);
    },
    onSuccess: async (result) => {
      setReleaseSourceDrawer(null);
      if ("token" in result) {
        toast({
          title: "Release source created",
          description: <IssuedTokenToast credential={{ id: result.releaseSource.releaseSourceId, token: result.token }} />,
          variant: "success",
          durationMs: 0,
        });
      } else {
        toast({ title: "Release source saved", variant: "success" });
      }
      await invalidateAll();
    },
  });

  const releaseSourceToggleMutation = useMutation({
    mutationFn: async (releaseSource: ApiReleaseSource) =>
      putReleaseSource(releaseSource.releaseSourceId, {
        ...releaseSource,
        active: !releaseSource.active,
      }),
    onSuccess: async () => {
      toast({ title: "Release source status updated", variant: "success" });
      await invalidateAll();
    },
  });

  const releaseSourceTokenMutation = useMutation<ApiRotateTokenResult, Error, string>({
    mutationFn: rotateReleaseSourceToken,
    onSuccess: async (result, releaseSourceId) => {
      toast({
        title: "Release source token rotated",
        description: <IssuedTokenToast credential={{ id: releaseSourceId, token: result.token }} />,
        variant: "success",
        durationMs: 0,
      });
      await invalidateAll();
    },
  });

  const environmentMutation = useMutation({
    mutationFn: async (environment: ApiEnvironment) => {
      return putEnvironment(environment.environmentId, environment);
    },
    onSuccess: async () => {
      setEnvironmentDrawer(null);
      toast({ title: "Environment saved", variant: "success" });
      await invalidateAll();
    },
  });

  if (query.isLoading) return <LoadingPanel label="Loading admin console..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label="No admin data returned by the API." />;

  const data = query.data;

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Role-gated management for principals, adapters, environments, and catalog resources."
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard icon={ShieldCheck} label="Current Access" value={auth.user?.roles[0] ?? "user"} sublabel={`${auth.user?.roles.length ?? 0} roles`} />
        <MetricCard icon={KeyRound} label="Resolved Permissions" value={String(auth.user?.permissions.length ?? 0)} sublabel="From /whoami" />
        <MetricCard
          icon={Rocket}
          label="Bootstrap"
          value={data.bootstrap.completed ? "Completed" : "Pending"}
          sublabel={data.bootstrap.completedBy ? `Completed by ${data.bootstrap.completedBy}` : "First human login not finished"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current principal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <MetaRow icon={Users} label="Display name" value={auth.user?.displayName ?? "-"} />
              <MetaRow icon={Server} label="Principal ID" value={auth.user?.principalId ?? "-"} />
              <MetaRow icon={KeyRound} label="Auth method" value={auth.user?.authMethod ?? "-"} />
              <MetaRow icon={Building2} label="Type" value={auth.user?.type ?? "-"} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(auth.user?.roles ?? []).map((role) => (
                  <Badge key={role} variant="slate">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(auth.user?.permissions ?? []).map((permission) => (
                  <Badge key={permission} variant="blue">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role map</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {auth.user?.roles.length ? (
              auth.user.roles.map((role) => (
                <div key={role} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{roleLabel(role)}</div>
                    <div className="text-xs text-slate-500">{roleDescription(role)}</div>
                  </div>
                  <Badge variant={role === ADMIN_ROLES.platformAdmin ? "green" : "slate"}>{role}</Badge>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No roles are attached to this principal.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ResourceSection
          title="Principals"
          subtitle="Human and service principals registered in the control plane."
          action={
            capabilities.canWritePrincipals ? (
              <Button onClick={() => setPrincipalDrawer({ mode: "create", principal: null })}>
                <Plus className="h-4 w-4" />
                Principal
              </Button>
            ) : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Principal</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seen</TableHead>
                {capabilities.canWritePrincipals ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.principals.map((principal) => (
                <TableRow key={principal.principalId}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{principal.displayName}</div>
                    <div className="text-xs text-slate-500">{principal.principalId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-700">{principal.type}</div>
                    <div className="text-xs text-slate-500">{principal.authMethod}</div>
                  </TableCell>
                  <TableCell>
                    <TagList tags={recordToInlineTags(principal.roles)} limit={3} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={principal.active ? "green" : "slate"}>{principal.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(principal.lastSeenAt)}</TableCell>
                  {capabilities.canWritePrincipals ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPrincipalDrawer({ mode: "edit", principal })}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => principalToggleMutation.mutate(principal)} disabled={principalToggleMutation.isPending}>
                          {principal.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          {principal.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResourceSection>

        <ResourceSection
          title="Deployment runners"
          subtitle="External executors that claim and report deployment work."
          action={
            capabilities.canWriteDeploymentRunners ? (
              <Button onClick={() => setRunnerDrawer({ mode: "create", runner: null })}>
                <Plus className="h-4 w-4" />
                Runner
              </Button>
            ) : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Runner</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heartbeat</TableHead>
                {capabilities.canWriteDeploymentRunners ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.deploymentRunners.map((runner) => (
                <TableRow key={runner.runnerId}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{runner.displayName}</div>
                    <div className="text-xs text-slate-500">{runner.runnerId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-700">{scopeSummary(runner.scope.environmentIds, runner.scope.componentSetIds)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={runner.active ? "green" : "slate"}>{runner.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(runner.lastHeartbeatAt)}</TableCell>
                  {capabilities.canWriteDeploymentRunners ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setRunnerDrawer({ mode: "edit", runner })}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => runnerTokenMutation.mutate(runner.runnerId)} disabled={runnerTokenMutation.isPending}>
                          <KeyRound className="h-4 w-4" />
                          Rotate token
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => runnerToggleMutation.mutate(runner)} disabled={runnerToggleMutation.isPending}>
                          {runner.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          {runner.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResourceSection>

        <ResourceSection
          title="Release sources"
          subtitle="External publishers that create immutable releases."
          action={
            capabilities.canWriteReleaseSources ? (
              <Button onClick={() => setReleaseSourceDrawer({ mode: "create", releaseSource: null })}>
                <Plus className="h-4 w-4" />
                Release source
              </Button>
            ) : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Release source</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last used</TableHead>
                {capabilities.canWriteReleaseSources ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.releaseSources.map((releaseSource) => (
                <TableRow key={releaseSource.releaseSourceId}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{releaseSource.displayName}</div>
                    <div className="text-xs text-slate-500">{releaseSource.releaseSourceId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-700">{releaseSourceScopeSummary(releaseSource.scope.componentIds, releaseSource.scope.componentSetIds)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={releaseSource.active ? "green" : "slate"}>{releaseSource.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(releaseSource.lastUsedAt)}</TableCell>
                  {capabilities.canWriteReleaseSources ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReleaseSourceDrawer({ mode: "edit", releaseSource })}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => releaseSourceTokenMutation.mutate(releaseSource.releaseSourceId)} disabled={releaseSourceTokenMutation.isPending}>
                          <KeyRound className="h-4 w-4" />
                          Rotate token
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => releaseSourceToggleMutation.mutate(releaseSource)} disabled={releaseSourceToggleMutation.isPending}>
                          {releaseSource.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          {releaseSource.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResourceSection>

        <ResourceSection
          title="Environments"
          subtitle="Runtime targets and the desired-state overlays attached to them."
          action={
            capabilities.canWriteEnvironments ? (
              <Button onClick={() => setEnvironmentDrawer({ mode: "create", environment: null })}>
                <Plus className="h-4 w-4" />
                Environment
              </Button>
            ) : null
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Environment</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                {capabilities.canWriteEnvironments ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.environments.map((environment) => (
                <TableRow key={environment.environmentId}>
                  <TableCell className="font-semibold text-slate-900">{environment.environmentId}</TableCell>
                  <TableCell>
                    <TagList tags={environment.tags} limit={3} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={environment.active ? "green" : "slate"}>{environment.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  {capabilities.canWriteEnvironments ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEnvironmentDrawer({ mode: "edit", environment })}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => environmentMutation.mutate(environment)} disabled={environmentMutation.isPending}>
                          {environment.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          {environment.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResourceSection>

        <CatalogSection
          title="Catalog"
          subtitle="Core resources the control plane manages and presents through their dedicated pages."
          items={[
            {
              title: "Components",
              count: data.components.length,
              icon: Package,
              to: "/components",
              canAct: capabilities.canWriteComponents,
              actionLabel: "Open components",
            },
            {
              title: "Component sets",
              count: data.componentSets.length,
              icon: Layers3,
              to: "/component-sets",
              canAct: capabilities.canWriteComponentSets,
              actionLabel: "Open component sets",
            },
            {
              title: "DeploySets",
              count: data.deploysets.length,
              icon: Database,
              to: "/deploysets",
              canAct: capabilities.canWriteDeploysets,
              actionLabel: "Open deploysets",
            },
            {
              title: "Releases",
              count: data.releases.length,
              icon: CircleFadingArrowUp,
              to: "/releases",
              canAct: capabilities.canCreateReleases,
              actionLabel: "Open releases",
            },
            {
              title: "Deployments",
              count: data.deploymentExecutions.length,
              icon: Rocket,
              to: "/deployments",
              canAct: capabilities.canCreateDeployments,
              actionLabel: "Open deployments",
            },
            {
              title: "Executions",
              count: data.deploymentExecutions.length,
              icon: PlayCircle,
              to: "/executions",
              canAct: capabilities.canClaimExecutions || capabilities.canReportExecutionStatus,
              actionLabel: "Open executions",
            },
          ]}
        />
      </div>

      {principalDrawer ? (
        <PrincipalDrawer
          drawerState={principalDrawer}
          onClose={() => setPrincipalDrawer(null)}
          onSubmit={(value) => principalMutation.mutate(value)}
          pending={principalMutation.isPending}
          currentUserId={auth.user?.principalId ?? "user:admin"}
        />
      ) : null}
      {runnerDrawer ? (
        <RunnerDrawer
          drawerState={runnerDrawer}
          onClose={() => setRunnerDrawer(null)}
          onSubmit={(value) => runnerMutation.mutate(value)}
          pending={runnerMutation.isPending}
          currentUserId={auth.user?.principalId ?? "user:admin"}
          environmentIds={data.environments.map((environment) => environment.environmentId)}
          componentSetIds={data.componentSets.map((componentSet) => componentSet.componentSetId)}
        />
      ) : null}
      {releaseSourceDrawer ? (
        <ReleaseSourceDrawer
          drawerState={releaseSourceDrawer}
          onClose={() => setReleaseSourceDrawer(null)}
          onSubmit={(value) => releaseSourceMutation.mutate(value)}
          pending={releaseSourceMutation.isPending}
          currentUserId={auth.user?.principalId ?? "user:admin"}
          componentIds={data.components.map((component) => component.componentId)}
          componentSetIds={data.componentSets.map((componentSet) => componentSet.componentSetId)}
        />
      ) : null}
      {environmentDrawer ? (
        <EnvironmentDrawer
          drawerState={environmentDrawer}
          onClose={() => setEnvironmentDrawer(null)}
          onSubmit={(value) => environmentMutation.mutate(value)}
          pending={environmentMutation.isPending}
        />
      ) : null}
    </>
  );
}

function ResourceSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-3">{children}</CardContent>
    </Card>
  );
}

function CatalogSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{
    title: string;
    count: number;
    icon: LucideIcon;
    to: string;
    actionLabel: string;
    canAct: boolean;
  }>;
}) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.count} records</div>
                </div>
              </div>
              <Badge variant="slate">{item.count}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link
                to={item.to}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                {item.actionLabel}
              </Link>
              {item.canAct ? <Badge variant="blue">Writable</Badge> : <Badge variant="slate">Read only</Badge>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, sublabel }: { icon: LucideIcon; label: string; value: string; sublabel: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="truncate text-lg font-bold text-slate-950">{value}</div>
          <div className="truncate text-xs text-slate-500">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </div>
      <div className="min-w-0 truncate text-sm text-slate-900">{value}</div>
    </div>
  );
}

function PrincipalDrawer({
  drawerState,
  onClose,
  onSubmit,
  pending,
  currentUserId,
}: {
  drawerState: Exclude<PrincipalDrawerState, null>;
  onClose: () => void;
  onSubmit: (principal: ApiPrincipal) => void;
  pending: boolean;
  currentUserId: string;
}) {
  const [principalId, setPrincipalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<"oidc" | "pat">("pat");
  const [externalIssuer, setExternalIssuer] = useState("");
  const [externalSubject, setExternalSubject] = useState("");
  const [active, setActive] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const existing = drawerState.mode === "edit" ? drawerState.principal : null;
  const trimmedPrincipalId = principalId.trim();
  const trimmedDisplayName = displayName.trim();
  const trimmedEmail = email.trim();
  const trimmedIssuer = externalIssuer.trim();
  const trimmedSubject = externalSubject.trim();
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    if (drawerState.mode === "edit") {
      setPrincipalId(drawerState.principal.principalId);
      setDisplayName(drawerState.principal.displayName);
      setEmail(drawerState.principal.email ?? "");
      setAuthMethod(drawerState.principal.authMethod === "oidc" ? "oidc" : "pat");
      setExternalIssuer(drawerState.principal.externalIssuer ?? "");
      setExternalSubject(drawerState.principal.externalSubject ?? "");
      setActive(drawerState.principal.active);
      setRoles(drawerState.principal.roles);
      setTags(recordToDrafts(drawerState.principal.tags));
      return;
    }

    setPrincipalId("");
    setDisplayName("");
    setEmail("");
    setAuthMethod("pat");
    setExternalIssuer("");
    setExternalSubject("");
    setActive(true);
    setRoles([]);
    setTags([createTagDraft()]);
  }, [drawerState]);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const toggleRole = (role: string) => {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  };

  const submit = () => {
    if (!trimmedPrincipalId || !trimmedDisplayName || (authMethod === "oidc" && (!trimmedIssuer || !trimmedSubject)) || tagsError) {
      return;
    }

    const timestamp = new Date().toISOString();
    onSubmit({
      principalId: drawerState.mode === "edit" ? drawerState.principal.principalId : trimmedPrincipalId,
      type: authMethod === "oidc" ? "user" : "service",
      displayName: trimmedDisplayName,
      email: trimmedEmail || null,
      authMethod,
      externalIssuer: authMethod === "oidc" ? trimmedIssuer : null,
      externalSubject: authMethod === "oidc" ? trimmedSubject : null,
      active,
      roles,
      tags: tagsToRecord(tags),
      createdAt: existing?.createdAt ?? timestamp,
      createdBy: existing?.createdBy ?? currentUserId,
      updatedAt: existing?.updatedAt ?? null,
      lastSeenAt: existing?.lastSeenAt ?? null,
    });
  };

  return (
    <SideDrawer
      open
      title={drawerState.mode === "edit" ? "Edit principal" : "Create principal"}
      description="Manage a human or service principal and the roles assigned to it."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !trimmedPrincipalId || !trimmedDisplayName || Boolean(tagsError) || (authMethod === "oidc" && (!trimmedIssuer || !trimmedSubject))} onClick={submit}>
            {pending ? "Saving..." : "Save principal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Principal ID
              <RequiredMark />
              <Input className="mt-1" value={principalId} onChange={(event) => setPrincipalId(event.target.value)} disabled={drawerState.mode === "edit"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Auth method
              <Select className="mt-1" value={authMethod} onChange={(event) => setAuthMethod(event.target.value as "oidc" | "pat")} disabled={drawerState.mode === "edit"}>
                <option value="pat">PAT</option>
                <option value="oidc">OIDC</option>
              </Select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <Input className="mt-1" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {authMethod === "oidc" ? (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  External issuer
                  <RequiredMark />
                  <Input className="mt-1" value={externalIssuer} onChange={(event) => setExternalIssuer(event.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  External subject
                  <RequiredMark />
                  <Input className="mt-1" value={externalSubject} onChange={(event) => setExternalSubject(event.target.value)} />
                </label>
              </>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Roles</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {ROLE_OPTIONS.map((role) => (
              <label key={role.value} className="flex items-center gap-3 text-sm text-slate-700">
                <input checked={roles.includes(role.value)} type="checkbox" onChange={() => toggleRole(role.value)} />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500">Role selection controls the permissions returned by /whoami.</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active principal</span>
              <span>Inactive principals cannot authenticate.</span>
            </span>
          </label>
        </section>

        <TagsCard
          title="Tags"
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

function RunnerDrawer({
  drawerState,
  onClose,
  onSubmit,
  pending,
  currentUserId,
  environmentIds: availableEnvironmentIds,
  componentSetIds: availableComponentSetIds,
}: {
  drawerState: Exclude<RunnerDrawerState, null>;
  onClose: () => void;
  onSubmit: (runner: ApiDeploymentRunner) => void;
  pending: boolean;
  currentUserId: string;
  environmentIds: string[];
  componentSetIds: string[];
}) {
  const [runnerId, setRunnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [webhookId, setWebhookId] = useState("");
  const [active, setActive] = useState(true);
  const [environmentIds, setEnvironmentIds] = useState<string[]>([]);
  const [componentSetIds, setComponentSetIds] = useState<string[]>([]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const existing = drawerState.mode === "edit" ? drawerState.runner : null;
  const trimmedRunnerId = runnerId.trim();
  const trimmedDisplayName = displayName.trim();
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    if (drawerState.mode === "edit") {
      setRunnerId(drawerState.runner.runnerId);
      setDisplayName(drawerState.runner.displayName);
      setWebhookId(drawerState.runner.webhookId ?? "");
      setActive(drawerState.runner.active);
      setEnvironmentIds(drawerState.runner.scope.environmentIds);
      setComponentSetIds(drawerState.runner.scope.componentSetIds);
      setTags(recordToDrafts(drawerState.runner.tags));
      return;
    }
    setRunnerId("");
    setDisplayName("");
    setWebhookId("");
    setActive(true);
    setEnvironmentIds([]);
    setComponentSetIds([]);
    setTags([createTagDraft()]);
  }, [drawerState]);

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
      runnerId: drawerState.mode === "edit" ? drawerState.runner.runnerId : trimmedRunnerId,
      displayName: trimmedDisplayName,
      principalId: existing?.principalId ?? `service:deployment-runner:${trimmedRunnerId}`,
      authMethod: existing?.authMethod ?? "pat",
      tokenHash: existing?.tokenHash ?? null,
      tokenPrefix: existing?.tokenPrefix ?? null,
      tokenCreatedAt: existing?.tokenCreatedAt ?? null,
      tokenRotatedAt: existing?.tokenRotatedAt ?? null,
      lastUsedAt: existing?.lastUsedAt ?? null,
      active,
      scope: {
        environmentIds,
        componentSetIds,
      },
      webhookId: webhookId.trim() || null,
      lastHeartbeatAt: existing?.lastHeartbeatAt ?? null,
      tags: tagsToRecord(tags),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      createdBy: existing?.createdBy ?? currentUserId,
    });
  };

  return (
    <SideDrawer
      open
      title={drawerState.mode === "edit" ? "Edit deployment runner" : "Create deployment runner"}
      description="Register the runner identity and the scope it can operate in."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !trimmedRunnerId || !trimmedDisplayName || Boolean(tagsError)} onClick={submit}>
            {pending ? "Saving..." : "Save runner"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Runner ID
              <RequiredMark />
              <Input className="mt-1" value={runnerId} onChange={(event) => setRunnerId(event.target.value)} disabled={drawerState.mode === "edit"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Scope</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ScopeChecklist
              title="Environments"
              options={availableEnvironmentIds}
              selected={environmentIds}
              onToggle={(value) => toggleValue(value, environmentIds, setEnvironmentIds)}
            />
            <ScopeChecklist
              title="Component sets"
              options={availableComponentSetIds}
              selected={componentSetIds}
              onToggle={(value) => toggleValue(value, componentSetIds, setComponentSetIds)}
            />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Webhook ID
            <Input className="mt-1" value={webhookId} onChange={(event) => setWebhookId(event.target.value)} />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active runner</span>
              <span>Inactive runners stop claiming new work.</span>
            </span>
          </label>
        </section>
        <TagsCard
          title="Tags"
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

function ReleaseSourceDrawer({
  drawerState,
  onClose,
  onSubmit,
  pending,
  currentUserId,
  componentIds: availableComponentIds,
  componentSetIds: availableComponentSetIds,
}: {
  drawerState: Exclude<ReleaseSourceDrawerState, null>;
  onClose: () => void;
  onSubmit: (releaseSource: ApiReleaseSource) => void;
  pending: boolean;
  currentUserId: string;
  componentIds: string[];
  componentSetIds: string[];
}) {
  const [releaseSourceId, setReleaseSourceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [active, setActive] = useState(true);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [componentSetIds, setComponentSetIds] = useState<string[]>([]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const existing = drawerState.mode === "edit" ? drawerState.releaseSource : null;
  const trimmedReleaseSourceId = releaseSourceId.trim();
  const trimmedDisplayName = displayName.trim();
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    if (drawerState.mode === "edit") {
      setReleaseSourceId(drawerState.releaseSource.releaseSourceId);
      setDisplayName(drawerState.releaseSource.displayName);
      setActive(drawerState.releaseSource.active);
      setComponentIds(drawerState.releaseSource.scope.componentIds);
      setComponentSetIds(drawerState.releaseSource.scope.componentSetIds);
      setTags(recordToDrafts(drawerState.releaseSource.tags));
      return;
    }
    setReleaseSourceId("");
    setDisplayName("");
    setActive(true);
    setComponentIds([]);
    setComponentSetIds([]);
    setTags([createTagDraft()]);
  }, [drawerState]);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const submit = () => {
    if (!trimmedReleaseSourceId || !trimmedDisplayName || tagsError) {
      return;
    }

    onSubmit({
      releaseSourceId: drawerState.mode === "edit" ? drawerState.releaseSource.releaseSourceId : trimmedReleaseSourceId,
      displayName: trimmedDisplayName,
      principalId: existing?.principalId ?? `service:release-source:${trimmedReleaseSourceId}`,
      authMethod: existing?.authMethod ?? "pat",
      tokenHash: existing?.tokenHash ?? null,
      tokenPrefix: existing?.tokenPrefix ?? null,
      tokenCreatedAt: existing?.tokenCreatedAt ?? null,
      tokenRotatedAt: existing?.tokenRotatedAt ?? null,
      lastUsedAt: existing?.lastUsedAt ?? null,
      active,
      scope: {
        componentIds,
        componentSetIds,
      },
      tags: tagsToRecord(tags),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      createdBy: existing?.createdBy ?? currentUserId,
    });
  };

  return (
    <SideDrawer
      open
      title={drawerState.mode === "edit" ? "Edit release source" : "Create release source"}
      description="Register the release publisher identity and its publish scope."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !trimmedReleaseSourceId || !trimmedDisplayName || Boolean(tagsError)} onClick={submit}>
            {pending ? "Saving..." : "Save release source"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Release source ID
              <RequiredMark />
              <Input className="mt-1" value={releaseSourceId} onChange={(event) => setReleaseSourceId(event.target.value)} disabled={drawerState.mode === "edit"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Scope</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ScopeChecklist title="Components" options={availableComponentIds} selected={componentIds} onToggle={(value) => toggleValue(value, componentIds, setComponentIds)} />
            <ScopeChecklist title="Component sets" options={availableComponentSetIds} selected={componentSetIds} onToggle={(value) => toggleValue(value, componentSetIds, setComponentSetIds)} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active release source</span>
              <span>Inactive release sources cannot publish releases.</span>
            </span>
          </label>
        </section>
        <TagsCard
          title="Tags"
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

function EnvironmentDrawer({
  drawerState,
  onClose,
  onSubmit,
  pending,
}: {
  drawerState: Exclude<EnvironmentDrawerState, null>;
  onClose: () => void;
  onSubmit: (environment: ApiEnvironment) => void;
  pending: boolean;
}) {
  const [environmentId, setEnvironmentId] = useState("");
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const trimmedEnvironmentId = environmentId.trim();
  const existing = drawerState.mode === "edit" ? drawerState.environment : null;
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    if (drawerState.mode === "edit") {
      setEnvironmentId(drawerState.environment.environmentId);
      setActive(drawerState.environment.active);
      setTags(recordToDrafts(drawerState.environment.tags));
      return;
    }
    setEnvironmentId("");
    setActive(true);
    setTags([createTagDraft()]);
  }, [drawerState]);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const submit = () => {
    if (!trimmedEnvironmentId || tagsError) {
      return;
    }

    onSubmit({
      environmentId: drawerState.mode === "edit" ? drawerState.environment.environmentId : trimmedEnvironmentId,
      active,
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open
      title={drawerState.mode === "edit" ? "Edit environment" : "Create environment"}
      description="Register a runtime target and control whether it is active."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !trimmedEnvironmentId || Boolean(tagsError)} onClick={submit}>
            {pending ? "Saving..." : "Save environment"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Environment ID
            <RequiredMark />
            <Input className="mt-1" value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)} disabled={drawerState.mode === "edit"} />
          </label>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active environment</span>
              <span>Inactive environments are hidden from planning surfaces.</span>
            </span>
          </label>
        </section>
        <TagsCard
          title="Tags"
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

function ScopeChecklist({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-2">
        {options.length ? (
          options.map((value) => (
            <label key={value} className="flex items-center gap-3 text-sm text-slate-700">
              <input checked={selected.includes(value)} type="checkbox" onChange={() => onToggle(value)} />
              <span>{value}</span>
            </label>
          ))
        ) : (
          <div className="text-sm text-slate-500">No options available.</div>
        )}
      </div>
    </div>
  );
}

function recordToDrafts(record: Record<string, string>) {
  const entries = Object.entries(record);
  return entries.length ? entries.map(([key, value]) => createTagDraft(key, value)) : [createTagDraft()];
}

function recordToInlineTags(values: string[]) {
  return Object.fromEntries(values.map((value) => [value, ""] as const));
}

function scopeSummary(environmentIds: string[], componentSetIds: string[]) {
  const parts = [
    environmentIds.length ? `${environmentIds.length} env${environmentIds.length === 1 ? "" : "s"}` : "all envs",
    componentSetIds.length ? `${componentSetIds.length} set${componentSetIds.length === 1 ? "" : "s"}` : "all sets",
  ];
  return parts.join(" • ");
}

function releaseSourceScopeSummary(componentIds: string[], componentSetIds: string[]) {
  const parts = [
    componentIds.length ? `${componentIds.length} comp${componentIds.length === 1 ? "" : "s"}` : "all comps",
    componentSetIds.length ? `${componentSetIds.length} set${componentSetIds.length === 1 ? "" : "s"}` : "all sets",
  ];
  return parts.join(" • ");
}

function roleLabel(role: string) {
  switch (role) {
    case ADMIN_ROLES.platformAdmin:
      return "Platform admin";
    case ADMIN_ROLES.platformDeployer:
      return "Platform deployer";
    case ADMIN_ROLES.platformViewer:
      return "Platform viewer";
    case ADMIN_ROLES.deploymentRunner:
      return "Deployment runner";
    case ADMIN_ROLES.releaseSource:
      return "Release source";
    default:
      return role;
  }
}

function roleDescription(role: string) {
  switch (role) {
    case ADMIN_ROLES.platformAdmin:
      return "Full control over all management actions.";
    case ADMIN_ROLES.platformDeployer:
      return "Can create and manage deployment-facing resources.";
    case ADMIN_ROLES.platformViewer:
      return "Read-only operational access.";
    case ADMIN_ROLES.deploymentRunner:
      return "Claims executions and reports item status.";
    case ADMIN_ROLES.releaseSource:
      return "Publishes releases into the control plane.";
    default:
      return "Custom role.";
  }
}

type IssuedCredential = {
  id: string;
  token: string;
};

function IssuedTokenToast({ credential }: { credential: IssuedCredential }) {
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    await navigator.clipboard.writeText(credential.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm">Copy this PAT now. For safety, the raw token is only shown once.</p>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{credential.id}</div>
      <div className="flex gap-2">
        <Input readOnly value={credential.token} className="h-9 bg-white font-mono text-xs" />
        <Button type="button" variant="outline" className="h-9 shrink-0 bg-white" onClick={copyToken}>
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
