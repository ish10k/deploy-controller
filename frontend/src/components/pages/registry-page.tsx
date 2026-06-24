import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";

import { LoadingOverlay, PageHeader } from "@/components/common/api-state";
import { ReleasesPage } from "@/components/pages/releases-page";
import { ComponentsPage } from "@/components/pages/components-page";
import { VersionsPage } from "@/components/pages/versions-page";
import { Button } from "@/components/ui/button";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { SwitchableCard, type SwitchableCardOption } from "@/components/ui/switchable-card";

type RegistryView = "components" | "releases" | "versions";

export function RegistryPage({ initialView = "versions" }: { initialView?: RegistryView } = {}) {
  const [view, setView] = useState<RegistryView>(initialView);
  const [componentSignal, setComponentSignal] = useState(0);
  const [releaseSignal, setReleaseSignal] = useState(0);
  const [versionSignal, setVersionSignal] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const options: SwitchableCardOption<RegistryView>[] = [
    { value: "versions", label: "Versions" },
    { value: "components", label: "Components" },
    { value: "releases", label: "Releases" },
  ];
  const openCreate = (nextView: RegistryView) => {
    setMenuOpen(false);
    setView(nextView);
    if (nextView === "components") {
      setComponentSignal((value) => value + 1);
    } else if (nextView === "releases") {
      setReleaseSignal((value) => value + 1);
    } else {
      setVersionSignal((value) => value + 1);
    }
  };
  const changeView = (nextView: RegistryView) => {
    if (nextView === "components") {
      setComponentSignal(0);
    } else if (nextView === "releases") {
      setReleaseSignal(0);
    } else {
      setVersionSignal(0);
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
        subtitle="Components, releases, and immutable versions."
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
                  onClick={() => openCreate("versions")}
                >
                  <ENTITY_ICONS.version className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold text-slate-700">Version</span>
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
                  onClick={() => openCreate("releases")}
                >
                  <ENTITY_ICONS.release className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold text-slate-700">Version set</span>
                    <span className="text-xs font-medium leading-4 text-slate-500">Group components for versions and deploys.</span>
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
          ) : view === "releases" ? (
          <ReleasesPage
              embedded
              createSignal={releaseSignal}
              search={search}
              refreshSignal={refreshSignal}
            />
          ) : (
            <VersionsPage
              embedded
              createSignal={versionSignal}
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





