import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  FileText,
  GitBranch,
  KeyRound,
  Plus,
  Rocket,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SideDrawer } from "@/components/ui/side-drawer";
import { SwitchableCard, type SwitchableCardOption } from "@/components/ui/switchable-card";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import {
  createPrincipal,
  getPrincipal,
  listComponentSets,
  listDeploysets,
  listDeploymentExecutions,
  listEvents,
  listPrincipals,
  listReleases,
  listRoles,
  putPrincipal,
  queryKeys,
  type ApiComponentSet,
  type ApiDeploySet,
  type ApiDeploymentExecution,
  type ApiEventLogEntry,
  type ApiPrincipal,
  type ApiRelease,
  type ApiRole,
} from "@/lib/api-client";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { canChangeUserPermissions, canCreateUsers, canViewRoles, canViewUsers } from "@/lib/user-permissions";

const USER_ROLE_OPTIONS = [
  "admin",
  "platform-deployer",
  "platform-viewer",
] as const;
const UNCHANGEABLE_USER_ROLES = new Set<string>(["admin", "platform-admin"]);

type IconComponent = typeof UserRound;

type UserActivity = {
  id: string;
  at: string | null;
  type: string;
  summary: ReactNode;
  detail: string;
};

type UserDetailData = {
  principal: ApiPrincipal;
  deployments: ApiDeploymentExecution[];
  releases: ApiRelease[];
  deploysets: ApiDeploySet[];
  componentSets: ApiComponentSet[];
  events: ApiEventLogEntry[];
  roles: ApiRole[];
};

type UserDetailView = "event-log" | "deployments" | "releases" | "deploysets";

export function UsersPage({
  embedded = false,
  createSignal = 0,
  search = "",
  refreshSignal = 0,
}: {
  embedded?: boolean;
  createSignal?: number;
  search?: string;
  refreshSignal?: number;
} = {}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const canView = canViewUsers(auth.user);
  const canCreate = canCreateUsers(auth.user);
  const query = useQuery({
    queryKey: queryKeys.principals,
    queryFn: listPrincipals,
    enabled: canView,
  });
  const rolesQuery = useQuery({
    queryKey: queryKeys.roles,
    queryFn: listRoles,
    enabled: canView,
  });
  const mutation = useMutation({
    mutationFn: createPrincipal,
    onSuccess: async (principal) => {
      setOpen(false);
      toast({ title: "User created", variant: "success" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.principals });
      await navigate({ to: "/users/$principalId", params: { principalId: principal.principalId } });
    },
  });

  useEffect(() => {
    if (createSignal > 0 && canCreate) {
      setOpen(true);
    }
  }, [canCreate, createSignal]);
  useEffect(() => {
    if (refreshSignal > 0) {
      void query.refetch();
      void rolesQuery.refetch();
    }
  }, [refreshSignal]);

  if (!canView) {
    return <UsersAccessPanel />;
  }
  if (query.isLoading) return <LoadingPanel label="Loading users..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;

  const normalizedSearch = search.trim().toLowerCase();
  const users = (query.data ?? []).filter((principal) => {
    if (principal.type !== "user") {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return [principal.principalId, principal.displayName, principal.email ?? "", principal.roles.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Users"
          subtitle="Human principals registered for OIDC access."
          action={
            canCreate ? (
              <Button className="px-4" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Create user
              </Button>
            ) : null
          }
        />
      ) : null}

      {embedded ? (
        users.length ? (
          <Table>
            <UsersTableContent users={users} />
          </Table>
        ) : (
          <div className="px-3 py-10 text-center text-sm text-slate-500">No users found.</div>
        )
      ) : (
        <Card>
          <CardContent className="p-3">
            {users.length ? (
              <Table>
                <UsersTableContent users={users} />
              </Table>
            ) : (
              <div className="px-3 py-10 text-center text-sm text-slate-500">No users found.</div>
            )}
          </CardContent>
        </Card>
      )}

      <UserDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(value) => mutation.mutate(value)}
        pending={mutation.isPending}
        createdBy={auth.user?.principalId ?? "user:unknown"}
        roleOptions={rolesQuery.data?.map((role) => role.roleId) ?? [...USER_ROLE_OPTIONS]}
      />
    </>
  );
}

function UsersTableContent({ users }: { users: ApiPrincipal[] }) {
  return (
    <>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last seen</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.principalId} className="hover:bg-slate-50">
            <TableCell>
              <EntityLink kind="user" to="/users/$principalId" params={{ principalId: user.principalId }}>
                {user.displayName}
              </EntityLink>
            </TableCell>
            <TableCell>{user.email ?? "-"}</TableCell>
            <TableCell>
              <TagList tags={rolesToTags(user.roles)} limit={3} />
            </TableCell>
            <TableCell>
              <Badge variant={user.active ? "green" : "slate"}>{user.active ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>{formatRelativeTime(user.lastSeenAt, { mode: "short" })}</TableCell>
            <TableCell>
              <TagList tags={user.tags} limit={3} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </>
  );
}

export function UserDetailsPage({ principalId }: { principalId: string }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [detailView, setDetailView] = useState<UserDetailView>("event-log");
  const canView = canViewUsers(auth.user);
  const canChangePermissions = canChangeUserPermissions(auth.user);
  const canReadRoles = canViewRoles(auth.user);
  const canReadEvents = Boolean(auth.user?.permissions.includes("events:read"));
  const query = useQuery({
    queryKey: ["users", "detail", principalId],
    enabled: canView,
    queryFn: async (): Promise<UserDetailData> => {
      type EventListResult = Awaited<ReturnType<typeof listEvents>>;
      const eventRequests = canReadEvents
        ? Promise.all([
            listEvents({ actorPrincipalId: principalId, limit: 50 }),
            listEvents({ resourceType: "principal", resourceId: principalId, limit: 50 }),
          ])
        : Promise.resolve([] as EventListResult[]);
      const roleRequest = canReadRoles ? listRoles() : Promise.resolve(USER_ROLE_OPTIONS.map((roleId) => ({ roleId }) as ApiRole));
      const [principal, deployments, releases, deploysets, componentSets, roles, eventResults] = await Promise.all([
        getPrincipal(principalId),
        listDeploymentExecutions(),
        listReleases(),
        listDeploysets(),
        listComponentSets(),
        roleRequest,
        eventRequests,
      ]);
      const eventsById = new Map<string, ApiEventLogEntry>();
      for (const result of eventResults) {
        for (const event of result.events) {
          eventsById.set(event.eventId, event);
        }
      }
      return {
        principal,
        deployments: deployments.filter((deployment) => matchesUser(principal, deployment.requestedBy) || matchesUser(principal, deployment.claimedBy)),
        releases: releases.filter((release) => matchesUser(principal, release.createdBy)),
        deploysets: deploysets.filter((deployset) => matchesUser(principal, deployset.createdBy)),
        componentSets: componentSets.filter((componentSet) => matchesUser(principal, componentSet.createdBy)),
        events: [...eventsById.values()].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
        roles,
      };
    },
    retry: 1,
  });
  const roleMutation = useMutation({
    mutationFn: (roles: string[]) => {
      if (!query.data?.principal) {
        throw new Error("User is not loaded.");
      }
      return putPrincipal(query.data.principal.principalId, {
        ...query.data.principal,
        roles,
      });
    },
    onSuccess: async () => {
      toast({ title: "User permissions updated", variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users", "detail", principalId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.principals }),
      ]);
    },
  });

  if (!canView) {
    return <UsersAccessPanel />;
  }
  if (query.isLoading) return <LoadingPanel label="Loading user details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.principal) return <EmptyPanel label={`User ${principalId} was not found.`} />;

  const { principal, deployments, releases, deploysets, componentSets, events, roles } = query.data;
  const activities = buildUserActivity(principal, deployments, releases, deploysets, componentSets);
  const detailViewOptions: SwitchableCardOption<UserDetailView>[] = [
    { value: "event-log", label: `Event log (${events.length || activities.length})` },
    { value: "deployments", label: `Deployments (${deployments.length})` },
    { value: "releases", label: `Releases (${releases.length})` },
    { value: "deploysets", label: `DeploySets (${deploysets.length + componentSets.length})` },
  ];

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={principal.displayName}
        subtitle="User identity, permissions, and related control-plane activity."
        action={
          <Link to="/users">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to users
            </Button>
          </Link>
        }
      />

      <div className="grid shrink-0 gap-4 xl:grid-cols-4 md:grid-cols-2">
        <FactCard icon={UserRound} label="Status" value={principal.active ? "Active" : "Inactive"} sublabel={principal.authMethod} />
        <FactCard icon={ShieldCheck} label="Roles" value={String(principal.roles.length)} sublabel={principal.roles[0] ?? "No roles"} />
        <FactCard icon={Rocket} label="Deployments" value={String(deployments.length)} sublabel="Requested or claimed" />
        <FactCard icon={GitBranch} label="Releases" value={String(releases.length)} sublabel="Created by user" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SwitchableCard
          ariaLabel="Select user detail content"
          value={detailView}
          options={detailViewOptions}
          onChange={setDetailView}
          contentClassName="min-h-0 flex-1 overflow-hidden p-0"
        >
          <UserDetailSwitcherContent
            view={detailView}
            activities={activities}
            events={events}
            deployments={deployments}
            releases={releases}
            deploysets={deploysets}
            componentSets={componentSets}
          />
        </SwitchableCard>

        <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
          <Card>
            <CardHeader>
              <CardTitle>User info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={UserRound} label="Principal" value={principal.principalId} />
              <MetaRow icon={FileText} label="Email" value={principal.email ?? "-"} />
              <MetaRow icon={KeyRound} label="Auth" value={principal.authMethod} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(principal.createdAt)} />
              <MetaRow icon={Clock3} label="Last seen" value={formatRelativeTime(principal.lastSeenAt, { mode: "short" })} />
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <span className="font-semibold text-slate-700">Tags</span>
                <TagList tags={principal.tags} emptyLabel="No tags" />
              </div>
            </CardContent>
          </Card>

          <UserPermissionsCard
            principal={principal}
            roleOptions={roles.map((role) => role.roleId)}
            canChange={canChangePermissions}
            pending={roleMutation.isPending}
            onSubmit={(roles) => roleMutation.mutate(roles)}
          />
        </div>
      </div>
    </div>
  );
}

function UserDrawer({
  open,
  onClose,
  onSubmit,
  pending,
  createdBy,
  roleOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (principal: ApiPrincipal) => void;
  pending: boolean;
  createdBy: string;
  roleOptions: string[];
}) {
  const [principalId, setPrincipalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [externalIssuer, setExternalIssuer] = useState("");
  const [externalSubject, setExternalSubject] = useState("");
  const [active, setActive] = useState(true);
  const [roles, setRoles] = useState<string[]>(["platform-viewer"]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const tagsError = validateTagDrafts(tags);
  const trimmedPrincipalId = principalId.trim();
  const trimmedDisplayName = displayName.trim();
  const trimmedIssuer = externalIssuer.trim();
  const trimmedSubject = externalSubject.trim();

  useEffect(() => {
    if (!open) return;
    setPrincipalId("");
    setDisplayName("");
    setEmail("");
    setExternalIssuer("");
    setExternalSubject("");
    setActive(true);
    setRoles(["platform-viewer"]);
    setTags([createTagDraft()]);
  }, [open]);

  const submit = () => {
    if (!trimmedPrincipalId || !trimmedDisplayName || !trimmedIssuer || !trimmedSubject || tagsError) {
      return;
    }
    onSubmit({
      principalId: trimmedPrincipalId,
      type: "user",
      displayName: trimmedDisplayName,
      email: email.trim() || null,
      authMethod: "oidc",
      externalIssuer: trimmedIssuer,
      externalSubject: trimmedSubject,
      active,
      roles,
      tags: tagsToRecord(tags),
      createdAt: new Date().toISOString(),
      createdBy,
      updatedAt: null,
      lastSeenAt: null,
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create user"
      description="Register a human OIDC principal."
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !trimmedPrincipalId || !trimmedDisplayName || !trimmedIssuer || !trimmedSubject || Boolean(tagsError)} onClick={submit}>
            {pending ? "Creating..." : "Create user"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Identity</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Principal ID
              <RequiredMark />
              <Input className="mt-1" value={principalId} onChange={(event) => setPrincipalId(event.target.value)} placeholder="user:issuer-subject" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Amit Kumar" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <Input className="mt-1" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              External issuer
              <RequiredMark />
              <Input className="mt-1" value={externalIssuer} onChange={(event) => setExternalIssuer(event.target.value)} placeholder="https://issuer.example/realms/settle" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              External subject
              <RequiredMark />
              <Input className="mt-1" value={externalSubject} onChange={(event) => setExternalSubject(event.target.value)} placeholder="oidc-subject" />
            </label>
          </div>
        </section>

        <RolePicker roles={roles} roleOptions={roleOptions} disabled={false} onChange={setRoles} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active user</span>
              <span>Inactive users cannot authenticate.</span>
            </span>
          </label>
        </section>

        <TagsCard
          tags={tags}
          error={tagsError}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={(id, patch) => setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)))}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

function UserPermissionsCard({
  principal,
  canChange,
  pending,
  roleOptions,
  onSubmit,
}: {
  principal: ApiPrincipal;
  roleOptions: string[];
  canChange: boolean;
  pending: boolean;
  onSubmit: (roles: string[]) => void;
}) {
  const [roles, setRoles] = useState(principal.roles);
  const changed = roles.join("\n") !== principal.roles.join("\n");

  useEffect(() => {
    setRoles(principal.roles);
  }, [principal.principalId, principal.roles]);

  return (
    <Card className="flex min-h-[240px] flex-col">
      <CardHeader>
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <RolePicker roles={roles} roleOptions={roleOptions} disabled={!canChange} onChange={setRoles} />
        <div className="mt-auto flex justify-end pt-2">
          {canChange ? (
            <Button disabled={!changed || pending} onClick={() => onSubmit(roles)}>
              <ShieldCheck className="h-4 w-4" />
              {pending ? "Saving..." : "Save permissions"}
            </Button>
          ) : (
            <Badge variant="slate">Read only</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RolePicker({ roles, roleOptions, disabled, onChange }: { roles: string[]; roleOptions: string[]; disabled: boolean; onChange: (roles: string[]) => void }) {
  const displayRoles = normalizeDisplayRoles(roles);
  const options = Array.from(new Set([...USER_ROLE_OPTIONS, ...roleOptions, ...displayRoles])).map((role) => (role === "platform-admin" ? "admin" : role));

  const toggleRole = (role: string) => {
    if (UNCHANGEABLE_USER_ROLES.has(role)) {
      return;
    }
    onChange(displayRoles.includes(role) ? displayRoles.filter((item) => item !== role) : [...displayRoles, role]);
  };

  return (
    <div className="rounded-lg bg-white px-2 py-3">
      <div className="grid gap-2">
        {Array.from(new Set(options)).map((role) => (
          <label key={role} className="flex items-center gap-3 px-1 py-1 text-sm text-slate-700">
            <input
              checked={displayRoles.includes(role)}
              disabled={disabled || UNCHANGEABLE_USER_ROLES.has(role)}
              type="checkbox"
              onChange={() => toggleRole(role)}
            />
            <span>{role}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function UserDetailSwitcherContent({
  view,
  activities,
  events,
  deployments,
  releases,
  deploysets,
  componentSets,
}: {
  view: UserDetailView;
  activities: UserActivity[];
  events: ApiEventLogEntry[];
  deployments: ApiDeploymentExecution[];
  releases: ApiRelease[];
  deploysets: ApiDeploySet[];
  componentSets: ApiComponentSet[];
}) {
  if (view === "deployments") {
    return <UserDeploymentsPanel deployments={deployments} />;
  }
  if (view === "releases") {
    return <UserReleasesPanel releases={releases} />;
  }
  if (view === "deploysets") {
    return <UserDeploysetsPanel deploysets={deploysets} componentSets={componentSets} />;
  }

  return <UserEventLogPanel activities={activities} events={events} />;
}

function UserEventLogPanel({ activities, events }: { activities: UserActivity[]; events: ApiEventLogEntry[] }) {
  if (!activities.length && !events.length) {
    return <EmptyCardMessage>No user activity found.</EmptyCardMessage>;
  }

  if (events.length) {
    return (
      <ScrollFade className="h-full" contentClassName="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.eventId}>
                <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                <TableCell>
                  <div className="font-mono text-[11px] font-semibold text-slate-900">{event.action}</div>
                  <div className="text-xs text-slate-500">{event.actorPrincipalId}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-900">{event.resourceType}</div>
                  <div className="font-mono text-[11px] text-slate-500">{event.resourceId}</div>
                </TableCell>
                <TableCell className="max-w-[440px] truncate">{event.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollFade>
    );
  }

  return (
    <ScrollFade className="h-full" contentClassName="px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell>{formatRelativeTime(activity.at, { mode: "short" })}</TableCell>
              <TableCell>
                <div className="font-semibold text-slate-900">{activity.type}</div>
                <div className="text-xs text-slate-500">{activity.summary}</div>
              </TableCell>
              <TableCell className="max-w-[440px] truncate">{activity.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollFade>
  );
}

function UserDeploymentsPanel({ deployments }: { deployments: ApiDeploymentExecution[] }) {
  if (!deployments.length) {
    return <EmptyCardMessage>No deployments found.</EmptyCardMessage>;
  }

  return (
    <ScrollFade className="h-full" contentClassName="px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deployment</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>DeploySet</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map((deployment) => (
            <TableRow key={deployment.deploymentExecutionId}>
              <TableCell>
                <EntityLink kind="deployment" to="/deployments/$deploymentExecutionId" params={{ deploymentExecutionId: deployment.deploymentExecutionId }}>
                  {deployment.deploymentExecutionId}
                </EntityLink>
              </TableCell>
              <TableCell>
                <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: deployment.environmentId }}>
                  {deployment.environmentId}
                </EntityLink>
              </TableCell>
              <TableCell>
                <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: deployment.deploySetId }}>
                  {deployment.deploySetId}
                </EntityLink>
              </TableCell>
              <TableCell>
                <StatusBadge status={deployment.status} />
              </TableCell>
              <TableCell>{formatDateTime(deployment.startedAt)}</TableCell>
              <TableCell>{formatDateTime(deployment.completedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollFade>
  );
}

function UserReleasesPanel({ releases }: { releases: ApiRelease[] }) {
  if (!releases.length) {
    return <EmptyCardMessage>No releases found.</EmptyCardMessage>;
  }

  return (
    <ScrollFade className="h-full" contentClassName="px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Artifact</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {releases.map((release) => (
            <TableRow key={`${release.componentId}:${release.version}`}>
              <TableCell>
                <EntityLink kind="component" to="/components/$componentId" params={{ componentId: release.componentId }}>
                  {release.componentId}
                </EntityLink>
              </TableCell>
              <TableCell>
                <EntityLink kind="release" to="/releases/$componentId/$version" params={{ componentId: release.componentId, version: release.version }}>
                  {release.version}
                </EntityLink>
              </TableCell>
              <TableCell className="max-w-[360px] truncate">{release.artifact.key}</TableCell>
              <TableCell>{formatDateTime(release.createdAt)}</TableCell>
              <TableCell>
                <TagList tags={release.tags} limit={2} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollFade>
  );
}

function UserDeploysetsPanel({ deploysets, componentSets }: { deploysets: ApiDeploySet[]; componentSets: ApiComponentSet[] }) {
  if (!deploysets.length && !componentSets.length) {
    return <EmptyCardMessage>No DeploySets or ComponentSets found.</EmptyCardMessage>;
  }

  return (
    <ScrollFade className="h-full" contentClassName="px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Component set</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deploysets.map((deployset) => (
            <TableRow key={`deployset:${deployset.deploySetId}`}>
              <TableCell>DeploySet</TableCell>
              <TableCell>
                <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: deployset.deploySetId }}>
                  {deployset.deploySetId}
                </EntityLink>
              </TableCell>
              <TableCell>
                <EntityLink kind="componentSet" to="/component-sets/$componentSetId" params={{ componentSetId: deployset.componentSetId }}>
                  {deployset.componentSetId}
                </EntityLink>
              </TableCell>
              <TableCell>{deployset.items.length}</TableCell>
              <TableCell>{formatDateTime(deployset.createdAt)}</TableCell>
              <TableCell>
                <TagList tags={deployset.tags} limit={2} />
              </TableCell>
            </TableRow>
          ))}
          {componentSets.map((componentSet) => (
            <TableRow key={`component-set:${componentSet.componentSetId}`}>
              <TableCell>ComponentSet</TableCell>
              <TableCell>
                <EntityLink kind="componentSet" to="/component-sets/$componentSetId" params={{ componentSetId: componentSet.componentSetId }}>
                  {componentSet.componentSetId}
                </EntityLink>
              </TableCell>
              <TableCell>-</TableCell>
              <TableCell>{componentSet.components.length}</TableCell>
              <TableCell>{formatDateTime(componentSet.createdAt)}</TableCell>
              <TableCell>
                <TagList tags={componentSet.tags} limit={2} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollFade>
  );
}

function EmptyCardMessage({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>;
}

function FactCard({ icon: Icon, label, value, sublabel }: { icon: IconComponent; label: string; value: string; sublabel: string }) {
  return (
    <Card className="h-[116px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 truncate text-lg font-bold text-slate-950">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: IconComponent; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="flex items-center gap-2 font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className="min-w-0 truncate text-slate-800">{value}</span>
    </div>
  );
}

function UsersAccessPanel() {
  return (
    <>
      <PageHeader title="Users" subtitle="Human principals registered for OIDC access." />
      <Card>
        <CardContent className="p-5 text-sm text-slate-700">Your current principal does not have permission to view users.</CardContent>
      </Card>
    </>
  );
}

function buildUserActivity(
  principal: ApiPrincipal,
  deployments: ApiDeploymentExecution[],
  releases: ApiRelease[],
  deploysets: ApiDeploySet[],
  componentSets: ApiComponentSet[],
) {
  const events: UserActivity[] = [
    {
      id: "principal-created",
      at: principal.createdAt,
      type: "User created",
      summary: principal.createdBy,
      detail: principal.principalId,
    },
  ];

  if (principal.updatedAt) {
    events.push({
      id: "principal-updated",
      at: principal.updatedAt,
      type: "User updated",
      summary: principal.displayName,
      detail: principal.roles.join(", ") || "No roles",
    });
  }
  if (principal.lastSeenAt) {
    events.push({
      id: "principal-seen",
      at: principal.lastSeenAt,
      type: "Last seen",
      summary: principal.authMethod,
      detail: principal.email ?? principal.principalId,
    });
  }

  for (const deployment of deployments) {
    events.push({
      id: `deployment:${deployment.deploymentExecutionId}`,
      at: deployment.startedAt,
      type: "Deployment",
      summary: <EntityLink kind="deployment" to="/deployments/$deploymentExecutionId" params={{ deploymentExecutionId: deployment.deploymentExecutionId }}>{deployment.deploymentExecutionId}</EntityLink>,
      detail: `${deployment.environmentId} / ${deployment.deploySetId} / ${deployment.status}`,
    });
  }
  for (const release of releases) {
    events.push({
      id: `release:${release.componentId}:${release.version}`,
      at: release.createdAt,
      type: "Release",
      summary: <EntityLink kind="release" to="/releases/$componentId/$version" params={{ componentId: release.componentId, version: release.version }}>{release.componentId} {release.version}</EntityLink>,
      detail: release.artifact.key,
    });
  }
  for (const deployset of deploysets) {
    events.push({
      id: `deployset:${deployset.deploySetId}`,
      at: deployset.createdAt,
      type: "DeploySet",
      summary: <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: deployset.deploySetId }}>{deployset.deploySetId}</EntityLink>,
      detail: `${deployset.componentSetId} / ${deployset.items.length} items`,
    });
  }
  for (const componentSet of componentSets) {
    events.push({
      id: `component-set:${componentSet.componentSetId}`,
      at: componentSet.createdAt,
      type: "ComponentSet",
      summary: <EntityLink kind="componentSet" to="/component-sets/$componentSetId" params={{ componentSetId: componentSet.componentSetId }}>{componentSet.componentSetId}</EntityLink>,
      detail: `${componentSet.components.length} components`,
    });
  }

  return events.sort((left, right) => (right.at ?? "").localeCompare(left.at ?? ""));
}

function matchesUser(principal: ApiPrincipal, value: string | null | undefined) {
  if (!value) return false;
  return value === principal.principalId || value === principal.email || value === principal.displayName;
}

function rolesToTags(roles: string[]) {
  return Object.fromEntries(normalizeDisplayRoles(roles).map((role) => [role, ""] as const));
}

function normalizeDisplayRoles(roles: string[]) {
  return roles.map((role) => (role === "platform-admin" ? "admin" : role));
}
