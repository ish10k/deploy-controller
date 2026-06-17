import {
  Bell,
  Rocket,
  Boxes,
  ChevronDown,
  ClipboardList,
  Component,
  Folder,
  GitBranch,
  HelpCircle,
  Home,
  KeyRound,
  Link2,
  Menu,
  PackageCheck,
  Unplug,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Server,
  Package,
  Puzzle,
  Dock,
  Shield,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "",
    items: [{ label: "Dashboard", icon: Home, to: "/" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Deployments", icon: Rocket, to: "/deployments" },
      { label: "DeploySets", icon: PackageCheck, to: "/deploysets" },
      { label: "Environments", icon: Server, to: "/environments" },
      { label: "Releases", icon: Package, to: "/releases" },
      { label: "Components", icon: Puzzle, to: "/components" },
      { label: "Component Sets", icon: Dock, to: "/component-sets" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "Adapters", icon: Unplug, to: "/adapters" },

    ],
  },
  {
    label: "Governance",
    items: [
      { label: "RBAC", icon: UserRound, to: "/unsupported/rbac" },
      { label: "Audit", icon: Shield, to: "/unsupported/audit" },
    ],
  },
];

const headerActions = [
  { label: "Notifications", icon: Bell },
  { label: "Help", icon: HelpCircle },
  { label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-40 flex h-[60px] items-center border-b border-slate-900 bg-[#07111f] px-5 text-white shadow-sm">
        <div className="flex w-[230px] shrink-0 items-center gap-1">
          <div className="flex h-7 w-7 items-center justify-center">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold tracking-normal">Deploy Controller</span>
          </div>
        </div>

        {/* <div className="ml-8 flex h-10 w-[596px] items-center rounded-lg border border-white/10 bg-white/10 px-3 shadow-inner">
          <Search className="h-4 w-4 text-slate-300" />
          <input
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400"
            placeholder="Search DeploySets, components, environments..."
          />
          <kbd className="rounded border border-white/20 bg-slate-900/50 px-2 py-0.5 text-xs text-slate-300">Ctrl K</kbd>
        </div> */}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1 border-r border-white/10 pr-4">
            {headerActions.map((action) => (
              <Button key={action.label} variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label={action.label}>
                <action.icon className="h-5 w-5" />
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">AK</div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Amit Kumar</div>
              <div className="text-xs text-slate-400">Platform Admin</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-300" />
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-[60px] z-30 flex w-[235px] flex-col border-r border-slate-200 bg-white">
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label || "main"} className={cn(groupIndex > 0 && "border-t border-slate-200 pt-5", "mb-5")}>
              {group.label ? (
                <div className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.label}</div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
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
          <div>© 2024 DeploySet Project (Open Source)</div>
        </div>
      </aside>

      <main className="min-h-screen pl-[235px] pt-[60px]">
        <div className="px-9 py-6">{children}</div>
      </main>
    </div>
  );
}
