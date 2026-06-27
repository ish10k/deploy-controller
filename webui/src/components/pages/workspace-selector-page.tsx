import { useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, Check, Dock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { workspaceAppPath, workspaceIdFromPath, workspaceRelativePath } from "@/lib/workspace-routes";

function activateCardAction(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/login") ||
    value.startsWith("/forbidden") ||
    value.startsWith("/auth/")
  ) {
    return "/deployments";
  }
  if (value.startsWith("/workspaces/select")) {
    return "/deployments";
  }
  return workspaceIdFromPath(value) ? workspaceRelativePath(value) : value;
}

export function WorkspaceSelectorPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { workspaceId, workspaces, setWorkspaceId } = useAppContext();
  const organizations = useMemo(() => {
    const fromAuth = auth.user?.organizations ?? [];
    if (fromAuth.length) {
      return fromAuth;
    }
    const organizationIds = Array.from(new Set(workspaces.map((workspace) => workspace.organizationId)));
    return organizationIds.map((organizationId) => ({
      organizationId,
      displayName: organizationId === "default" ? "Default organization" : organizationId,
      roles: auth.user?.roles ?? [],
    }));
  }, [auth.user?.organizations, auth.user?.roles, workspaces]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const returnTo = safeReturnTo();
  const selectedOrganization = organizations.find((organization) => organization.organizationId === selectedOrganizationId) ?? null;
  const organizationWorkspaces = selectedOrganizationId
    ? workspaces.filter((workspace) => workspace.organizationId === selectedOrganizationId)
    : [];

  const selectWorkspace = async (nextWorkspaceId: string) => {
    setWorkspaceId(nextWorkspaceId);
    await navigate({ to: workspaceAppPath(nextWorkspaceId, returnTo) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 py-10 text-slate-950">
      <Card className="flex min-h-[520px] w-full max-w-3xl flex-col bg-white shadow-lg">
        <CardHeader className="items-center justify-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
            {selectedOrganization ? <Dock className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{selectedOrganization ? "Select workspace" : "Select organization"}</CardTitle>
            <p className="mt-0.5 text-sm text-slate-600">
              {selectedOrganization ? selectedOrganization.displayName : "Choose an organization before selecting a workspace."}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-5">
          {selectedOrganization ? (
            <>
              {organizationWorkspaces.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {organizationWorkspaces.map((workspace) => {
                    const selected = workspace.workspaceId === workspaceId;
                    return (
                      <Card
                        key={workspace.workspaceId}
                        className={cn(
                          "min-h-[104px] cursor-pointer border p-3 text-left transition-colors",
                          selected ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                        role="button"
                        tabIndex={0}
                        onClick={() => void selectWorkspace(workspace.workspaceId)}
                        onKeyDown={(event) => activateCardAction(event, () => void selectWorkspace(workspace.workspaceId))}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-100",
                              selected ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {selected ? <Check className="h-4 w-4" /> : <Dock className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-950">{workspace.displayName}</span>
                            <span className="mt-1 block break-all text-xs text-slate-500">{workspace.workspaceId}</span>
                            <span className="mt-2 flex flex-wrap gap-1">
                              {workspace.roles.length ? (
                                workspace.roles.map((role) => (
                                  <span key={role} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {role}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">No workspace roles</span>
                              )}
                            </span>
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No workspaces are available for this organization.</div>
              )}

              <Button variant="outline" className="mt-auto w-fit" onClick={() => setSelectedOrganizationId(null)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </>
          ) : organizations.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {organizations.map((organization) => {
                const workspaceCount = workspaces.filter((workspace) => workspace.organizationId === organization.organizationId).length;
                const selected = workspaces.some((workspace) => workspace.organizationId === organization.organizationId && workspace.workspaceId === workspaceId);
                return (
                  <Card
                    key={organization.organizationId}
                    className={cn(
                      "min-h-[100px] cursor-pointer border p-3 text-left transition-colors",
                      selected ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOrganizationId(organization.organizationId)}
                    onKeyDown={(event) => activateCardAction(event, () => setSelectedOrganizationId(organization.organizationId))}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-100",
                          selected ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-950">{organization.displayName}</span>
                        <span className="mt-1 block break-all text-xs text-slate-500">{organization.organizationId}</span>
                        <span className="mt-2 block text-xs font-medium text-slate-500">
                          {workspaceCount} {workspaceCount === 1 ? "workspace" : "workspaces"}
                        </span>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : workspaces.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {workspaces.map((workspace) => {
                const selected = workspace.workspaceId === workspaceId;
                return (
                  <Card
                    key={workspace.workspaceId}
                    className={cn(
                      "cursor-pointer border p-3 text-left transition-colors",
                      selected ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => void selectWorkspace(workspace.workspaceId)}
                    onKeyDown={(event) => activateCardAction(event, () => void selectWorkspace(workspace.workspaceId))}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-100",
                          selected ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <Dock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-950">{workspace.displayName}</span>
                        <span className="mt-1 block break-all text-xs text-slate-500">{workspace.workspaceId}</span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {workspace.roles.length ? (
                            workspace.roles.map((role) => (
                              <span key={role} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No workspace roles</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No organizations or workspaces are available for this user.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

