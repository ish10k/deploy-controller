import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Check, Copy, FileText, GitBranch, Package, RefreshCcw, Server, Tag, UserRound } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagList } from "@/components/ui/tag-list";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import { getVersion, listDeployments, type ApiVersion } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export function VersionDetailsPage({ componentId, version }: { componentId: string; version: string }) {
  const query = useQuery({
    queryKey: ["versions", "detail", componentId, version],
    queryFn: () => getVersion(componentId, version),
    retry: 1,
  });
  if (query.isLoading) return <LoadingPanel label="Loading version details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label={`Version ${componentId}/${version} was not found.`} />;

  return <VersionDetailsView version={query.data} onRefresh={() => query.refetch()} />;
}

function VersionDetailsView({ version, onRefresh }: { version: ApiVersion; onRefresh: () => Promise<unknown> }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const deploymentsQuery = useQuery({
    queryKey: ["deployments", "for-version", version.componentId, version.version],
    queryFn: () => listDeployments(),
    retry: 1,
  });

  const relatedDeployments = useMemo(() => {
    const executions = deploymentsQuery.data ?? [];

    return executions
      .filter((execution) => execution.items.some((item) => item.componentId === version.componentId && item.version === version.version))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [deploymentsQuery.data, version.componentId, version.version]);

  useEffect(() => {
    if (!copiedField) return undefined;

    const timer = window.setTimeout(() => setCopiedField(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedField]);

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Version: ${version.componentId} ${version.version}`}
        subtitle="Version artifact, source, and delivery notes."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void Promise.all([onRefresh(), deploymentsQuery.refetch()])}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Link to="/versions">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to versions
              </Button>
            </Link>
            <Link to="/components/$componentId" params={{ componentId: version.componentId }}>
              <Button variant="outline">Component</Button>
            </Link>
          </div>
        }
      />

      <div className="mt-4 grid shrink-0 grid-cols-3 gap-4">
        <Link
          to="/components/$componentId"
          params={{ componentId: version.componentId }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <FactCard icon={Package} label="Component" value={version.componentId} sublabel={version.version} interactive />
        </Link>
        <FactCard icon={CalendarClock} label="Created" value={formatDateTime(version.createdAt)} sublabel={`By ${version.createdBy}`} />
        <FactCard
          icon={Server}
          label="Deploys"
          value={relatedDeployments.length.toString()}
          sublabel="Executions including this version"
        />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Recent deployments</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollFade className="h-full" contentClassName="px-4 pb-4">
              {deploymentsQuery.isLoading ? (
                <LoadingPanel label="Loading deployments..." />
              ) : deploymentsQuery.error ? (
                <ApiErrorPanel error={deploymentsQuery.error} onRetry={() => deploymentsQuery.refetch()} />
              ) : relatedDeployments.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deployment</TableHead>
                      <TableHead>Release</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedDeployments.map((execution) => (
                      <TableRow key={execution.deploymentId}>
                        <TableCell>
                          <EntityLink kind="deployment" to="/deployments/$deploymentId" params={{ deploymentId: execution.deploymentId }}>
                            {execution.deploymentId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink kind="release" to="/releases/$releaseId" params={{ releaseId: execution.releaseId }}>
                            {execution.releaseId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: execution.environmentId }}>
                            {execution.environmentId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={execution.status} />
                        </TableCell>
                        <TableCell>{formatDateTime(execution.startedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyPanel label="No deployments include this version yet." />
              )}
            </ScrollFade>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Version metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <MetaRow
              icon={Package}
              label="Component"
              value={
                <EntityLink kind="component" to="/components/$componentId" params={{ componentId: version.componentId }}>
                  {version.componentId}
                </EntityLink>
              }
            />
            <MetaRow
              icon={Package}
              label="Version"
              value={
                <EntityLink
                  kind="version"
                  to="/versions/$componentId/$version"
                  params={{ componentId: version.componentId, version: version.version }}
                >
                  {version.version}
                </EntityLink>
              }
            />
            <MetaRow icon={UserRound} label="Created by" value={version.createdBy} />
            <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(version.createdAt)} />
            <MetaRow icon={FileText} label="Description" value={version.description ?? "None"} multiline />
            <MetaRow icon={FileText} label="Notes" value={version.notes ?? "None"} multiline />
            <CopyableMetaRow icon={Package} label="Artifact key" value={version.artifact.key} copiedField={copiedField} onCopy={setCopiedField} />
            <CopyableMetaRow icon={FileText} label="Artifact digest" value={version.artifact.digest} copiedField={copiedField} onCopy={setCopiedField} />
            <CopyableMetaRow icon={GitBranch} label="Source key" value={version.source?.key ?? "None"} copiedField={copiedField} onCopy={setCopiedField} />
            <CopyableMetaRow icon={FileText} label="Source digest" value={version.source?.digest ?? "None"} copiedField={copiedField} onCopy={setCopiedField} />
            <MetaRow icon={Server} label="In deployments" value={relatedDeployments.length.toString()} />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="flex items-start gap-2 font-semibold text-slate-700">
                <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                Tags
              </span>
              <TagList tags={version.tags} emptyLabel="No tags" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
  sublabel,
  interactive = false,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sublabel: string;
  interactive?: boolean;
}) {
  return (
    <Card className={`h-[116px] ${interactive ? "transition-colors hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md" : ""}`}>
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

function MetaRow({ icon: Icon, label, value, multiline = false }: { icon: typeof Package; label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[120px_1fr] gap-3 ${multiline ? "items-start" : "items-center"}`}>
      <span className={`flex gap-2 font-semibold text-slate-700 ${multiline ? "items-start" : "items-center"}`}>
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className={`min-w-0 text-slate-800 ${multiline ? "whitespace-pre-wrap break-words" : "whitespace-normal break-words"}`}>{value}</span>
    </div>
  );
}

function CopyableMetaRow({
  icon: Icon,
  label,
  value,
  copiedField,
  onCopy,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  copiedField: string | null;
  onCopy: (field: string | null) => void;
}) {
  const fieldKey = label.toLowerCase();
  const copied = copiedField === fieldKey;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const copyValue = async () => {
    await navigator.clipboard.writeText(value);
    onCopy(fieldKey);
    window.setTimeout(() => buttonRef.current?.blur(), 0);
  };

  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
      <span className="flex items-start gap-2 font-semibold text-slate-700">
        <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
        {label}
      </span>
      <div className="group flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-800">{value}</span>
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon"
          onClick={copyValue}
          className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}



