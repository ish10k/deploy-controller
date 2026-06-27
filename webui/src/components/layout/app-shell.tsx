import {
  ArrowLeft,
  Bell,
  HatGlasses,
  HelpCircle,
  LibraryBig,
  Menu,
  RefreshCcw,
  Settings,
  Play,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { ForbiddenPage, LoginPage } from "@/components/auth/auth-pages";
import { LoadingPanel } from "@/components/common/api-state";
import { listEvents, queryKeys, type ApiEventLogEntry } from "@/lib/api-client";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { useAppContext } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { canViewEvents, canViewRoles, canViewTags, canViewUsers, canViewWebhooks } from "@/lib/user-permissions";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { workspaceAppPath, workspaceIdFromPath, workspaceRelativePath } from "@/lib/workspace-routes";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  aliases?: string[];
  hidden?: boolean;
};

function navGroups(showUsers: boolean, showRoles: boolean, showWebhooks: boolean, showTags: boolean): Array<{ label: string; items: NavItem[] }> {
  return [
    {
      label: "Operations",
      items: [
        { label: "Deployments", icon: ENTITY_ICONS.deployment, to: "/deployments", aliases: ["/executions"] },
        { label: "Environments", icon: ENTITY_ICONS.environment, to: "/environments" },
        { label: "Registry", icon: LibraryBig, to: "/registry", aliases: ["/components", "/releases", "/versions"] },
      ],
    },
    {
      label: "Integrations",
      items: [
        { label: "Publishers", icon: ENTITY_ICONS.publisher, to: "/publishers" },
        { label: "Runners", icon: Play, to: "/deployment-runners" },
        { label: "Webhooks", icon: ENTITY_ICONS.webhook, to: "/webhooks", hidden: !showWebhooks },
      ],
    },
    {
      label: "Governance",
      items: [
        { label: "Users", icon: ENTITY_ICONS.user, to: "/users", aliases: ["/roles"], hidden: !showUsers && !showRoles },
        { label: "Tags", icon: ENTITY_ICONS.tag, to: "/tags", hidden: !showTags },
        { label: "Audit", icon: HatGlasses, to: "/audit" },
      ],
    },
  ];
}

const headerActions = [
  { label: "Help", icon: HelpCircle },
  { label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const routeStatus = useRouterState({ select: (state) => (state as { status?: string }).status ?? "idle" });
  const navigate = useNavigate();
  const auth = useAuth();
  const app = useAppContext();
  const isAuthRoute = pathname === "/login" || pathname === "/auth/callback" || pathname === "/forbidden";
  const isWorkspaceSelectorRoute = pathname === "/workspaces/select";
  const routeWorkspaceId = workspaceIdFromPath(pathname);
  const routeWorkspaceKnown = routeWorkspaceId ? app.workspaces.some((workspace) => workspace.workspaceId === routeWorkspaceId) : false;
  const redirectTarget =
    auth.status === "authenticated" && app.workspace && !isAuthRoute && !isWorkspaceSelectorRoute
      ? routeWorkspaceId && !routeWorkspaceKnown
        ? workspaceAppPath(app.workspaceId, workspaceRelativePath(pathname))
        : null
      : null;
  const pageLoading = useMinimumPageLoading(pathname, routeStatus === "pending");

  useEffect(() => {
    if (auth.status !== "authenticated" || isAuthRoute || isWorkspaceSelectorRoute) {
      return;
    }
    if (routeWorkspaceId && routeWorkspaceKnown && routeWorkspaceId !== app.workspaceId) {
      app.setWorkspaceId(routeWorkspaceId);
    }
  }, [app, auth.status, isAuthRoute, isWorkspaceSelectorRoute, routeWorkspaceId, routeWorkspaceKnown]);

  useEffect(() => {
    if (!redirectTarget) {
      return;
    }
    void navigate({ to: redirectTarget, replace: true });
  }, [navigate, redirectTarget]);

  if (isAuthRoute) {
    return <>{children}</>;
  }
  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md">
          <LoadingPanel label="Checking your OneRelease session..." />
        </div>
      </div>
    );
  }
  if (auth.status === "anonymous") {
    return <LoginPage />;
  }
  if (auth.status === "forbidden") {
    return <ForbiddenPage />;
  }
  if (isWorkspaceSelectorRoute) {
    return <>{children}</>;
  }
  if (!app.workspace) {
    return <WorkspaceRequired />;
  }
  if (routeWorkspaceId && routeWorkspaceId !== app.workspaceId) {
    return <WorkspaceSwitching />;
  }
  if (redirectTarget) {
    return <WorkspaceSwitching />;
  }

  const initials = auth.user?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const primaryRole = auth.user?.roles?.[0] ?? "user";
  const groups = navGroups(canViewUsers(auth.user), canViewRoles(auth.user), canViewWebhooks(auth.user), canViewTags(auth.user));
  const activePath = routeWorkspaceId ? workspaceRelativePath(pathname) : pathname;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-40 flex h-[60px] items-center border-b border-slate-900 bg-[#07111f] px-5 text-white shadow-sm">
        <div className="flex w-[230px] shrink-0 items-center">
          <img src="/logo_white.png" alt="OneVersion" className="h-8 w-auto" />
        </div>

        {/* <div className="ml-8 flex h-10 w-[596px] items-center rounded-lg border border-white/10 bg-white/10 px-3 shadow-inner">
          <Search className="h-4 w-4 text-slate-300" />
          <input
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400"
            placeholder="Search Releases, components, environments..."
          />
          <kbd className="rounded border border-white/20 bg-slate-900/50 px-2 py-0.5 text-xs text-slate-300">Ctrl K</kbd>
        </div> */}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1 border-r border-white/10 pr-4">
            <NotificationBell principalId={auth.user?.principalId} enabled={canViewEvents(auth.user)} />
            {headerActions.map((action) => (
              <Button key={action.label} variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label={action.label}>
                <action.icon className="h-5 w-5" />
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">{initials}</div>
            <div className="leading-tight">
              <div className="text-sm font-bold">{auth.user?.displayName}</div>
              <div className="text-xs text-slate-400">{primaryRole}</div>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void auth.logout()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-[60px] z-30 flex w-[235px] flex-col border-r border-slate-200 bg-white">
        <WorkspaceSidebarControl workspaceName={app.workspace.displayName} />
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {groups.map((group, groupIndex) => (
            <div key={group.label || "main"} className={cn(groupIndex > 0 && "border-t border-slate-200 pt-5", "mb-5")}>
              {group.label ? (
                <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.label}</div>
              ) : null}
              <div className="space-y-1">
                {group.items.filter((item) => !item.hidden).map((item) => {
                  const active =
                    item.to === "/"
                      ? activePath === "/"
                      : activePath.startsWith(item.to) || (item.aliases ?? []).some((alias) => activePath.startsWith(alias));
                  return (
                    <Link
                      key={item.label}
                      to={workspaceAppPath(app.workspaceId, item.to)}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 transition-colors",
                        active ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 hover:text-slate-950",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-6 px-5 pb-4 text-xs text-slate-500">
          <button className="flex items-center gap-3 text-slate-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
              <Menu className="h-4 w-4" />
            </span>
            Collapse
          </button>
          <div>© 2024 Release Project (Open Source)</div>
        </div>
      </aside>

      <main className="relative min-h-screen pl-[235px] pt-[60px]">
        <PageLoadScreen visible={pageLoading} />
        <div className="px-9 py-6">{children}</div>
      </main>
    </div>
  );
}

function useMinimumPageLoading(pathname: string, active: boolean, minimumMs = 450) {
  const previousPathname = useRef(pathname);
  const shownAt = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const pathChanged = previousPathname.current !== pathname;
    if (pathChanged || active) {
      previousPathname.current = pathname;
      shownAt.current = Date.now();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(true);
      return;
    }

    if (!visible) {
      return;
    }

    const remaining = Math.max(0, minimumMs - (Date.now() - shownAt.current));
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, remaining);
  }, [active, minimumMs, pathname, visible]);

  return visible;
}

function PageLoadScreen({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed bottom-0 right-0 top-[60px] z-20 flex items-center justify-center bg-slate-50 pl-[235px]",
        visible ? "pointer-events-auto" : "pointer-events-none hidden",
      )}
      style={{ left: 0 }}
    >
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
        <RefreshCcw className="h-4 w-4 animate-spin text-blue-600" />
        Loading...
      </div>
    </div>
  );
}

function WorkspaceSidebarControl({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="border-b border-slate-200 px-4 py-4">
      <Link
        to="/workspaces/select"
        className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
      >
        <ArrowLeft className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-800">{workspaceName}</span>
          <span className="block text-xs font-medium text-slate-500">Change workspace</span>
        </span>
      </Link>
    </div>
  );
}

function WorkspaceRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <LoadingPanel label="Select a workspace to continue..." />
      </div>
    </div>
  );
}

function WorkspaceSwitching() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <LoadingPanel label="Loading workspace..." />
      </div>
    </div>
  );
}

function NotificationBell({ principalId, enabled }: { principalId: string | undefined; enabled: boolean }) {
  if (!enabled) {
    return (
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label="Notifications" disabled>
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return <EventNotificationBell principalId={principalId} />;
}

function EventNotificationBell({ principalId }: { principalId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const storageKey = principalId ? `onerelease.notifications.readAt.${principalId}` : "onerelease.notifications.readAt.anonymous";
  const [readAt, setReadAt] = useState(() => readNotificationTimestamp(storageKey));
  const recentWindowMs = 30 * 60 * 1000;
  const query = useQuery({
    queryKey: queryKeys.events({ limit: 50 }),
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - recentWindowMs);
      return listEvents({
        limit: 50,
        from: from.toISOString(),
        to: to.toISOString(),
      });
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
  const events = useMemo(() => (query.data?.events ?? []).filter(isNotificationEvent).slice(0, 25), [query.data?.events]);
  const unreadCount = useMemo(
    () => (readAt ? events.filter((event) => event.occurredAt > readAt).length : events.length),
    [events, readAt],
  );

  useEffect(() => {
    setReadAt(readNotificationTimestamp(storageKey));
  }, [storageKey]);

  const markRead = () => {
    const latest = events[0]?.occurredAt;
    if (!latest) {
      return;
    }
    window.localStorage.setItem(storageKey, latest);
    setReadAt(latest);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative text-white hover:bg-white/10 hover:text-white"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            markRead();
          }
          setOpen((current) => !current);
        }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#07111f]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-xl">
          <div className="border-b border-slate-200 px-4 py-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-slate-500" />
              Notifications
            </CardTitle>
          </div>
          <div className="max-h-[480px] overflow-y-auto shadow-[inset_0_6px_10px_-10px_rgba(15,23,42,0.18)]">
            {query.isLoading ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Loading notifications...</div>
            ) : query.error ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-red-600">Unable to load notifications.</div>
            ) : events.length ? (
              events.map((event) => (
                <NotificationEntry
                  key={event.eventId}
                  event={event}
                  unread={!readAt || event.occurredAt > readAt}
                  onNavigate={() => {
                    markRead();
                    setOpen(false);
                  }}
                />
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No recent events.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationEntry({ event, unread, onNavigate }: { event: ApiEventLogEntry; unread: boolean; onNavigate: () => void }) {
  const target = notificationTarget(event);

  return (
    <a
      href={target.href}
      onClick={onNavigate}
      className={cn(
        "block border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50",
        unread && "bg-blue-50/70 hover:bg-blue-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-950">{event.summary}</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">{event.actorPrincipalId}</div>
            </div>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500">{formatRelativeTime(event.occurredAt, { mode: "short" })}</span>
      </div>
    </a>
  );
}

function notificationTarget(event: ApiEventLogEntry) {
  const versionParts = event.resourceType === "version" ? event.resourceId.split(/[:@]/) : [];
  const targets: Record<string, string> = {
    component: `/components/${encodeURIComponent(event.resourceId)}`,
    release: `/releases/${encodeURIComponent(event.resourceId)}`,
    deployment: `/deployments/${encodeURIComponent(event.resourceId)}`,
    environment: `/environments/${encodeURIComponent(event.resourceId)}`,
    deploymentRunner: `/deployment-runners/${encodeURIComponent(event.resourceId)}`,
    principal: `/users/${encodeURIComponent(event.resourceId)}`,
    role: `/roles/${encodeURIComponent(event.resourceId)}`,
    publisher: `/publishers/${encodeURIComponent(event.resourceId)}`,
    webhook: `/webhooks/${encodeURIComponent(event.resourceId)}`,
  };

  if (event.resourceType === "version" && versionParts.length >= 2) {
    return {
      href: `/versions/${encodeURIComponent(versionParts[0])}/${encodeURIComponent(versionParts.slice(1).join(":"))}`,
    };
  }

  return {
    href: targets[event.resourceType] ?? `/audit`,
  };
}

function readNotificationTimestamp(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

const NOTIFICATION_ACTIONS = new Set([
  "release.created",
  "deployment.created",
  "deployment.claimed",
  "deployment.status_changed",
  "deployment_item.status_reported",
  "version.created",
  "publisher.created",
  "publisher.token_rotated",
  "deployment_runner.created",
  "deployment_runner.token_rotated",
  "principal.created",
  "principal.bootstrap_created",
  "principal.roles_changed",
  "role.created",
  "role.updated",
  "webhook.created",
  "webhook.updated",
]);

function isNotificationEvent(event: ApiEventLogEntry) {
  if (event.severity === "error" || event.severity === "warning") {
    return true;
  }
  return NOTIFICATION_ACTIONS.has(event.action);
}



