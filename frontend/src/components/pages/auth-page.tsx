import { useEffect, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";

import { LoadingOverlay, PageHeader } from "@/components/common/api-state";
import { RolesPage } from "@/components/pages/roles-page";
import { UsersPage } from "@/components/pages/users-page";
import { Button } from "@/components/ui/button";
import { SwitchableCard, type SwitchableCardOption } from "@/components/ui/switchable-card";
import { useAuth } from "@/lib/auth-context";
import { canChangeRoles, canCreateUsers } from "@/lib/user-permissions";

type AuthView = "users" | "roles";

export function AuthPage({ initialView = "users" }: { initialView?: AuthView } = {}) {
  const auth = useAuth();
  const [view, setView] = useState<AuthView>(initialView);
  const [userCreateSignal, setUserCreateSignal] = useState(0);
  const [roleCreateSignal, setRoleCreateSignal] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const options: SwitchableCardOption<AuthView>[] = [
    { value: "users", label: "Users" },
    { value: "roles", label: "Roles" },
  ];
  const changeView = (nextView: AuthView) => {
    if (nextView === "users") {
      setUserCreateSignal(0);
    } else {
      setRoleCreateSignal(0);
    }
    setView(nextView);
  };
  const refresh = () => {
    setRefreshing(true);
    setRefreshSignal((value) => value + 1);
  };

  useEffect(() => {
    if (!refreshing) {
      return;
    }

    const timeout = window.setTimeout(() => setRefreshing(false), 350);
    return () => window.clearTimeout(timeout);
  }, [refreshing, refreshSignal]);

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Users"
        subtitle="Human principals and RBAC role definitions."
        action={
          <div className="flex flex-wrap gap-2">
            {canCreateUsers(auth.user) ? (
              <Button className="px-4" onClick={() => {
                setView("users");
                setUserCreateSignal((value) => value + 1);
              }}>
                <UserRound className="h-4 w-4" />
                Create user
              </Button>
            ) : null}
            {canChangeRoles(auth.user) ? (
              <Button className="px-4" onClick={() => {
                setView("roles");
                setRoleCreateSignal((value) => value + 1);
              }}>
                <ShieldCheck className="h-4 w-4" />
                Create role
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-[310px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="relative mt-5 flex-1">
        {refreshing ? <LoadingOverlay /> : null}
        <SwitchableCard
          ariaLabel="Select auth view"
          value={view}
          options={options}
          onChange={changeView}
          className="flex h-full flex-col"
          contentClassName="min-h-0 flex-1 overflow-auto px-4 pb-4"
        >
          {view === "users" ? (
            <UsersPage embedded createSignal={userCreateSignal} search={search} refreshSignal={refreshSignal} />
          ) : (
            <RolesPage embedded createSignal={roleCreateSignal} search={search} refreshSignal={refreshSignal} />
          )}
        </SwitchableCard>
      </div>
    </div>
  );
}
