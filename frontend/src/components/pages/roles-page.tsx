import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, ShieldCheck } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { canChangeRoles, canViewRoles } from "@/lib/user-permissions";
import { getRole, listRoles, putRole, queryKeys, type ApiRole } from "@/lib/api-client";

const AVAILABLE_PERMISSIONS = [
  "components:read",
  "components:write",
  "component_sets:read",
  "component_sets:write",
  "releases:read",
  "releases:create",
  "deploysets:read",
  "deploysets:create",
  "environments:read",
  "environments:write",
  "deployments:read",
  "deployments:create",
  "deployments:cancel",
  "executions:claim",
  "executions:report_status",
  "deployment_runners:write",
  "release_sources:write",
  "release_sources:publish",
  "principals:read",
  "principals:write",
  "roles:read",
  "roles:write",
  "events:read",
  "webhooks:read",
  "webhooks:write",
  "webhook_deliveries:read",
  "webhook_deliveries:retry",
] as const;

const PERMISSION_GROUPS = [
  { label: "Registry", prefix: ["components:", "component_sets:", "releases:", "release_sources:"] },
  { label: "Deployments", prefix: ["deploysets:", "deployments:", "executions:", "deployment_runners:"] },
  { label: "Governance", prefix: ["principals:", "roles:", "events:"] },
  { label: "Webhooks", prefix: ["webhooks:", "webhook_deliveries:"] },
];

export function RolesPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const canView = canViewRoles(auth.user);
  const canChange = canChangeRoles(auth.user);
  const query = useQuery({ queryKey: queryKeys.roles, queryFn: listRoles, enabled: canView });
  const mutation = useMutation({
    mutationFn: (role: ApiRole) => putRole(role.roleId, role),
    onSuccess: async () => {
      setOpen(false);
      toast({ title: "Role created", variant: "success" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
  });

  if (!canView) return <RolesAccessPanel />;
  if (query.isLoading) return <LoadingPanel label="Loading roles..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;

  const roles = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="RBAC role definitions and permission sets."
        action={
          canChange ? (
            <Button className="h-10 px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Create role
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-3">
          {roles.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.roleId} className="hover:bg-slate-50">
                    <TableCell>
                      <Link to="/roles/$roleId" params={{ roleId: role.roleId }} className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:text-blue-900">
                        <ShieldCheck className="h-4 w-4" />
                        {role.roleId}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[460px] whitespace-normal">{role.description ?? "-"}</TableCell>
                    <TableCell>{role.permissions.length}</TableCell>
                    <TableCell>
                      <Badge variant={role.system ? "blue" : "slate"}>{role.system ? "System" : "Custom"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyPanel label="No roles found." />
          )}
        </CardContent>
      </Card>

      <RoleDrawer open={open} pending={mutation.isPending} onClose={() => setOpen(false)} onSubmit={(role) => mutation.mutate(role)} />
    </>
  );
}

export function RoleDetailsPage({ roleId }: { roleId: string }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canView = canViewRoles(auth.user);
  const canChange = canChangeRoles(auth.user);
  const query = useQuery({ queryKey: queryKeys.role(roleId), queryFn: () => getRole(roleId), enabled: canView });
  const mutation = useMutation({
    mutationFn: (role: ApiRole) => putRole(role.roleId, role),
    onSuccess: async (role) => {
      toast({ title: "Role saved", variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.role(role.roleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roles }),
      ]);
    },
  });

  if (!canView) return <RolesAccessPanel />;
  if (query.isLoading) return <LoadingPanel label="Loading role..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label={`Role ${roleId} was not found.`} />;

  return <RoleEditor role={query.data} canChange={canChange && query.data.permissionsEditable} pending={mutation.isPending} onSubmit={(role) => mutation.mutate(role)} />;
}

function RoleEditor({ role, canChange, pending, onSubmit }: { role: ApiRole; canChange: boolean; pending: boolean; onSubmit: (role: ApiRole) => void }) {
  const [description, setDescription] = useState(role.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role.permissions);

  useEffect(() => {
    setDescription(role.description ?? "");
    setPermissions(role.permissions);
  }, [role.roleId, role.description, role.permissions]);

  const changed = description !== (role.description ?? "") || [...permissions].sort().join("\n") !== [...role.permissions].sort().join("\n");

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={role.roleId}
        subtitle={role.system ? "System role definition." : "Custom role definition."}
        action={
          <Link to="/roles">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to roles
            </Button>
          </Link>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-4">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Role info</CardTitle>
            <Badge variant={role.permissionsEditable ? "slate" : "blue"}>{role.permissionsEditable ? "Editable" : "System managed"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="block text-sm font-medium text-slate-700">
              Description
              <Input disabled={!canChange} className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="text-sm text-slate-600">
              {permissions.length} permissions selected
            </div>
            <Button disabled={!canChange || !changed || pending} onClick={() => onSubmit({ ...role, description: description || null, permissions })}>
              <Save className="h-4 w-4" />
              {pending ? "Saving..." : "Save role"}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto p-4">
            <PermissionPicker permissions={permissions} disabled={!canChange} onChange={setPermissions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PermissionPicker({ permissions, disabled, onChange }: { permissions: string[]; disabled: boolean; onChange: (permissions: string[]) => void }) {
  const selected = new Set(permissions);
  const toggle = (permission: string) => {
    if (selected.has(permission)) {
      onChange(permissions.filter((item) => item !== permission));
    } else {
      onChange([...permissions, permission].sort());
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => {
        const groupPermissions = AVAILABLE_PERMISSIONS.filter((permission) => group.prefix.some((prefix) => permission.startsWith(prefix)));
        return (
          <section key={group.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="mb-3 text-sm font-bold text-slate-950">{group.label}</h3>
            <div className="grid gap-2">
              {groupPermissions.map((permission) => (
                <label key={permission} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700", !disabled && "hover:bg-slate-50")}>
                  <input checked={selected.has(permission)} disabled={disabled} type="checkbox" onChange={() => toggle(permission)} />
                  <span className="font-mono text-xs">{permission}</span>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RoleDrawer({ open, pending, onClose, onSubmit }: { open: boolean; pending: boolean; onClose: () => void; onSubmit: (role: ApiRole) => void }) {
  const [roleId, setRoleId] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const trimmedRoleId = roleId.trim();

  useEffect(() => {
    if (!open) return;
    setRoleId("");
    setDescription("");
    setPermissions([]);
  }, [open]);

  return (
    <SideDrawer
      open={open}
      title="Create role"
      description="Define a custom RBAC role."
      onClose={onClose}
      maxWidth="max-w-[920px]"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !trimmedRoleId}
            onClick={() => onSubmit({ roleId: trimmedRoleId, description: description || null, permissions, system: false, permissionsEditable: true })}
          >
            {pending ? "Creating..." : "Create role"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Role ID
              <RequiredMark />
              <Input className="mt-1" value={roleId} onChange={(event) => setRoleId(event.target.value)} placeholder="release-manager" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <Input className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </CardContent>
        </Card>
        <PermissionPicker permissions={permissions} disabled={false} onChange={setPermissions} />
      </div>
    </SideDrawer>
  );
}

function RolesAccessPanel() {
  return (
    <>
      <PageHeader title="Roles" subtitle="RBAC role definitions and permission sets." />
      <Card>
        <CardContent className="p-5 text-sm text-slate-700">Your current principal does not have permission to view roles.</CardContent>
      </Card>
    </>
  );
}
