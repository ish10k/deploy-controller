import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Filter, MoreHorizontal, Rocket, Search, TimerReset, XCircle, X } from "lucide-react";
import { flexRender, getCoreRowModel, type ColumnDef, useReactTable } from "@tanstack/react-table";

import { ApiErrorPanel, EmptyPanel, LoadingPanel } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { DeploymentWorkflowPage } from "@/components/pages/deployment-workflow-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchDashboardData, queryKeys, type ApiDeploymentExecution } from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { formatDateTime } from "@/lib/format";
import { Link } from "@tanstack/react-router";

type DeploymentsPageProps = {
  initialPlanOpen?: boolean;
  onPlanClose?: () => void;
};

export function DeploymentsPage({ initialPlanOpen = false, onPlanClose }: DeploymentsPageProps = {}) {
  const { environmentId } = useAppContext();
  const [planOpen, setPlanOpen] = useState(initialPlanOpen);
  const [planMounted, setPlanMounted] = useState(initialPlanOpen);
  const [planEntered, setPlanEntered] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "running" | "failed">("all");
  const query = useQuery({
    queryKey: queryKeys.dashboard(environmentId),
    queryFn: () => fetchDashboardData(environmentId),
    retry: 1,
  });

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

  const executions = query.data?.executions ?? [];
  const pendingCount = executions.filter((execution) => execution.status === "pending").length;
  const runningCount = executions.filter((execution) => execution.status === "claimed" || execution.status === "running").length;
  const failedCount = executions.filter((execution) => execution.status === "failed").length;
  const filteredExecutions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return executions.filter((execution) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
            ? execution.status === "pending"
            : statusFilter === "running"
              ? execution.status === "claimed" || execution.status === "running"
              : execution.status === "failed";

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        execution.deploymentExecutionId,
        execution.deploySetId,
        execution.environmentId,
        execution.claimedBy ?? "",
        execution.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [executions, search, statusFilter]);

  if (query.isLoading) return <LoadingPanel label="Loading deployment dashboard..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel />;

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-normal text-slate-950">Deployments</h1>
            <span className="text-sm font-bold text-blue-600">Info</span>
          </div>
        </div>
        <Button
          className="h-10 px-4"
          onClick={() => {
            setPlanMounted(true);
            setPlanOpen(true);
            setPlanEntered(false);
          }}
        >
          <Rocket className="h-5 w-5" />
          Deploy
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-4">
        <MetricCard icon={TimerReset} label="Pending" value={pendingCount} tone="orange" />
        <MetricCard icon={AlertTriangle} label="Running" value={runningCount} tone="blue" />
        <MetricCard icon={XCircle} label="Failed" value={failedCount} tone="red" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-[290px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search executions..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none"
          >
            <option value="all">Status: All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            More filters
          </Button>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>

      <Card className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
          {filteredExecutions.length ? (
            <ScrollFade className="flex-1 rounded-t-lg">
              <ExecutionTable rows={filteredExecutions} />
            </ScrollFade>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyPanel label="No executions match the current filters." />
            </div>
          )}
        </CardContent>
      </Card>

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
              <DeploymentWorkflowPage showHeader={false} onCreated={closePlan} onCancel={closePlan} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TimerReset;
  label: string;
  value: number;
  tone: "orange" | "blue" | "red";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-500",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
  } as const;

  const values = {
    orange: "text-orange-600",
    blue: "text-blue-700",
    red: "text-red-700",
  } as const;

  return (
    <Card className="h-[116px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className={`mt-1 text-2xl font-bold ${values[tone]}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
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
      { header: "Claimed By", cell: ({ row }) => row.original.claimedBy ?? "-" },
      { header: "Started", cell: ({ row }) => formatDateTime(row.original.startedAt) },
      { header: "Updated", cell: ({ row }) => formatDateTime(row.original.completedAt ?? row.original.startedAt) },
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
