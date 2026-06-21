import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";

import { LoadingOverlay, PageHeader } from "@/components/common/api-state";
import { DeploysetsPage } from "@/components/pages/deploysets-page";
import { ComponentsPage } from "@/components/pages/components-page";
import { ReleasesPage } from "@/components/pages/releases-page";
import { Button } from "@/components/ui/button";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { SwitchableCard, type SwitchableCardOption } from "@/components/ui/switchable-card";

type RegistryView = "components" | "release-sets" | "releases";

export function RegistryPage({ initialView = "releases" }: { initialView?: RegistryView } = {}) {
  const [view, setView] = useState<RegistryView>(initialView);
  const [componentSignal, setComponentSignal] = useState(0);
  const [releaseSetSignal, setReleaseSetSignal] = useState(0);
  const [releaseSignal, setReleaseSignal] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const options: SwitchableCardOption<RegistryView>[] = [
    { value: "releases", label: "Releases" },
    { value: "components", label: "Components" },
    { value: "release-sets", label: "ReleaseSets" },
  ];
  const openCreate = (nextView: RegistryView) => {
    setMenuOpen(false);
    setView(nextView);
    if (nextView === "components") {
      setComponentSignal((value) => value + 1);
    } else if (nextView === "release-sets") {
      setReleaseSetSignal((value) => value + 1);
    } else {
      setReleaseSignal((value) => value + 1);
    }
  };
  const changeView = (nextView: RegistryView) => {
    if (nextView === "components") {
      setComponentSignal(0);
    } else if (nextView === "release-sets") {
      setReleaseSetSignal(0);
    } else {
      setReleaseSignal(0);
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
        title="Registry"
        subtitle="Components, release sets, and immutable release versions."
        action={
          <div className="relative">
            <Button className="px-4" onClick={() => setMenuOpen((open) => !open)}>
              <Plus className="h-4 w-4" />
              Create Resource
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => openCreate("releases")}
                >
                  <ENTITY_ICONS.release className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold text-slate-700">Release</span>
                    <span className="text-xs font-medium leading-4 text-slate-500">Publish a new immutable version.</span>
                  </span>
                </button>
                <hr className="my-1 border-slate-200" />
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => openCreate("components")}
                >
                  <ENTITY_ICONS.component className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold text-slate-700">Component</span>
                    <span className="text-xs font-medium leading-4 text-slate-500">Register a deployable unit.</span>
                  </span>
                </button>
                <hr className="my-1 border-slate-200" />
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => openCreate("release-sets")}
                >
                  <ENTITY_ICONS.releaseSet className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold text-slate-700">Release set</span>
                    <span className="text-xs font-medium leading-4 text-slate-500">Group components for releases and deploys.</span>
                  </span>
                </button>
              </div>
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
          ariaLabel="Select registry view"
          value={view}
          options={options}
          onChange={changeView}
          className="flex h-full flex-col"
          contentClassName="min-h-0 flex-1 overflow-auto px-4 pb-4"
        >
          {view === "components" ? (
            <ComponentsPage embedded createSignal={componentSignal} search={search} refreshSignal={refreshSignal} />
          ) : view === "release-sets" ? (
          <DeploysetsPage
              embedded
              createSignal={releaseSetSignal}
              search={search}
              refreshSignal={refreshSignal}
            />
          ) : (
            <ReleasesPage
              embedded
              createSignal={releaseSignal}
              search={search}
              refreshSignal={refreshSignal}
              onCreateComponent={() => {
                setView("components");
                setComponentSignal((value) => value + 1);
              }}
            />
          )}
        </SwitchableCard>
      </div>
    </div>
  );
}

