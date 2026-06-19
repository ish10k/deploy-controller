import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Plus, RefreshCw, Rocket, Search, X } from "lucide-react";
import { flexRender, getCoreRowModel, type ColumnDef, useReactTable } from "@tanstack/react-table";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, PageHeader, useMinimumVisible } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { DeploymentWorkflowPage } from "@/components/pages/deployment-workflow-page";
import { DeploysetsPage } from "@/components/pages/deploysets-page";
import { Button } from "@/components/ui/button";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SwitchableCard, type SwitchableCardOption } from "@/components/ui/switchable-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import { fetchDashboardData, queryKeys, type ApiDeploymentExecution } from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { formatRelativeTime } from "@/lib/format";

type DeploymentsPageProps = {
  initialView?: DeploymentWorkspaceView;
  initialPlanOpen?: boolean;
  onPlanClose?: () => void;
};

type DeploymentWorkspaceView = "executions" | "deploysets";

export function DeploymentsPage({ initialView = "executions", initialPlanOpen = false, onPlanClose }: DeploymentsPageProps = {}) {
  const { environmentId } = useAppContext();
  const [view, setView] = useState<DeploymentWorkspaceView>(initialView);
  const [planOpen, setPlanOpen] = useState(initialPlanOpen);
  const [planMounted, setPlanMounted] = useState(initialPlanOpen);
  const [planEntered, setPlanEntered] = useState(false);
  const [deploysetCreateSignal, setDeploysetCreateSignal] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [search, setSearch] = useState("");
  const options: SwitchableCardOption<DeploymentWorkspaceView>[] = [
    { value: "executions", label: "Deployments" },
    { value: "deploysets", label: "DeploySets" },
  ];
  const query = useQuery({
    queryKey: queryKeys.dashboard(environmentId),
    queryFn: () => fetchDashboardData(environmentId),
    retry: 1,
  });
  const refreshing = useMinimumVisible(query.isFetching && !query.isLoading);

  useEffect(() => {
    if (planOpen) {
      setPlanMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setPlanMounted(false), 250);
    return () => window.clearTimeout(timeout);
  }, [planOpen]);

  useEffect(() => {
    if (!planMounted) {
      return;
    }

    if (planOpen) {
      const frame = window.requestAnimationFrame(() => setPlanEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setPlanEntered(false);
  }, [planMounted, planOpen]);

  useEffect(() => {
    if (!planMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlanOpen(false);
        onPlanClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onPlanClose, planMounted]);

  const closePlan = () => {
    setPlanEntered(false);
    setPlanOpen(false);
    onPlanClose?.();
  };
  const openPlan = () => {
    setView("executions");
    setPlanMounted(true);
    setPlanOpen(true);
    setPlanEntered(false);
  };
  const openDeploysetDrawer = () => {
    setDeploysetCreateSignal((value) => value + 1);
  };
  const clearDeploysetCreateSignal = () => {
    setDeploysetCreateSignal(0);
  };
  const changeView = (nextView: DeploymentWorkspaceView) => {
    if (nextView === "deploysets") {
      setDeploysetCreateSignal(0);
    }
    setView(nextView);
  };

  const executions = query.data?.executions ?? [];
  const filteredExecutions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return executions.filter((execution) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        execution.deploymentExecutionId,
        execution.deploySetId,
        execution.environmentId,
        execution.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [executions, search]);

  if (query.isLoading) return <LoadingPanel label="Loading deployment dashboard..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel />;

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Deployments"
        subtitle="Plan deployments and track execution state across environments."
        action={
          <div className="flex flex-wrap gap-2">
            <Button className="px-4" onClick={openPlan}>
              <Rocket className="h-5 w-5" />
              Deploy
            </Button>
            <Button className="px-4" onClick={openDeploysetDrawer}>
              <Plus className="h-5 w-5" />
              Create DeploySet
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-[310px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <Button variant="outline" onClick={() => {
          setRefreshSignal((value) => value + 1);
          void query.refetch();
        }}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="relative mt-5 min-h-0 flex-1">
        {refreshing ? <LoadingOverlay /> : null}
        <SwitchableCard
          ariaLabel="Select deployment workspace view"
          value={view}
          options={options}
          onChange={changeView}
          className="flex h-full flex-col"
          contentClassName="min-h-0 flex-1 overflow-auto px-4 pb-4"
        >
          {view === "executions" ? (
            filteredExecutions.length ? (
              <ScrollFade className="flex-1 rounded-t-lg">
                <ExecutionTable rows={filteredExecutions} />
              </ScrollFade>
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <EmptyPanel label="No executions match the current filters." />
              </div>
            )
          ) : (
            <DeploysetsPage
              embedded
              createSignal={deploysetCreateSignal}
              onCreateSignalHandled={clearDeploysetCreateSignal}
              search={search}
              refreshSignal={refreshSignal}
            />
          )}
        </SwitchableCard>
      </div>

      {view !== "deploysets" ? (
        <DeploysetsPage
          drawerOnly
          createSignal={deploysetCreateSignal}
          onCreateSignalHandled={clearDeploysetCreateSignal}
          refreshSignal={refreshSignal}
        />
      ) : null}

      {planMounted ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close deployment planner"
            className={`absolute inset-0 z-0 bg-slate-950/30 transition-opacity duration-300 ${planEntered ? "opacity-100" : "opacity-0"}`}
            onClick={closePlan}
          />
          <aside
            className={`absolute right-0 top-0 z-10 flex h-full w-full max-w-[860px] transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
              planEntered ? "translate-x-0" : "translate-x-full"
            }`}
            aria-label="Deployment planner"
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Create Deployment</h2>
                <p className="mt-1 text-sm text-slate-600">Deploy a DeploySet to an environment.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closePlan} aria-label="Close deployment planner">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <DeploymentWorkflowPage showHeader={false} onCreated={closePlan} onCancel={closePlan} onCreateDeploySet={() => {
                closePlan();
                openDeploysetDrawer();
              }} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function ExecutionTable({
  rows,
}: {
  rows: ApiDeploymentExecution[];
}) {
  const columns = useMemo<ColumnDef<ApiDeploymentExecution>[]>(
    () => [
      {
        header: "Execution ID",
        accessorKey: "deploymentExecutionId",
        cell: ({ row }) => (
          <EntityLink
            kind="deployment"
            to="/deployments/$deploymentExecutionId"
            params={{ deploymentExecutionId: row.original.deploymentExecutionId }}
          >
            {row.original.deploymentExecutionId}
          </EntityLink>
        ),
      },
      {
        header: "DeploySet",
        cell: ({ row }) => (
          <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: row.original.deploySetId }}>
            {row.original.deploySetId}
          </EntityLink>
        ),
      },
      {
        header: "Environment",
        cell: ({ row }) => (
          <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: row.original.environmentId }}>
            {row.original.environmentId}
          </EntityLink>
        ),
      },
      { header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        header: "Updated",
        cell: ({ row }) => formatRelativeTime(row.original.completedAt ?? row.original.startedAt, { mode: "short" }),
      },
      { header: "Started", cell: ({ row }) => formatRelativeTime(row.original.startedAt, { mode: "short" }) },
      {
        id: "actions",
        cell: ({ row }) => (
          <Link to="/deployments/$deploymentExecutionId" params={{ deploymentExecutionId: row.original.deploymentExecutionId }} aria-label={`View ${row.original.deploymentExecutionId}`}>
            <MoreHorizontal className="ml-auto h-4 w-4 text-blue-700" />
          </Link>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-white">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="hover:bg-slate-50">
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
