import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, FileText, GitBranch, Package, Tag, UserRound } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { TagList } from "@/components/ui/tag-list";
import { getRelease, type ApiRelease } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export function ReleaseDetailsPage({ componentId, version }: { componentId: string; version: string }) {
  const query = useQuery({
    queryKey: ["releases", "detail", componentId, version],
    queryFn: () => getRelease(componentId, version),
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading release details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label={`Release ${componentId}/${version} was not found.`} />;

  return <ReleaseDetailsView release={query.data} />;
}

function ReleaseDetailsView({ release }: { release: ApiRelease }) {
  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`${release.componentId} ${release.version}`}
        subtitle="Release artifact, source, and delivery notes."
        action={
          <div className="flex gap-2">
            <Link to="/releases">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to releases
              </Button>
            </Link>
            <Link to="/components/$componentId" params={{ componentId: release.componentId }}>
              <Button variant="outline">Component</Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-3 gap-4">
        <Link
          to="/components/$componentId"
          params={{ componentId: release.componentId }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <FactCard icon={Package} label="Component" value={release.componentId} sublabel={`Version ${release.version}`} interactive />
        </Link>
        <FactCard icon={CalendarClock} label="Created" value={formatDateTime(release.createdAt)} sublabel={`By ${release.createdBy}`} />
        <FactCard icon={GitBranch} label="Artifact" value={release.artifact.key} sublabel={release.source?.digest ?? "No source digest"} />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Release metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <MetaRow
              icon={Package}
              label="Component"
              value={
                <EntityLink kind="component" to="/components/$componentId" params={{ componentId: release.componentId }}>
                  {release.componentId}
                </EntityLink>
              }
            />
            <MetaRow
              icon={Package}
              label="Version"
              value={
                <EntityLink
                  kind="release"
                  to="/releases/$componentId/$version"
                  params={{ componentId: release.componentId, version: release.version }}
                >
                  {release.version}
                </EntityLink>
              }
            />
            <MetaRow icon={UserRound} label="Created by" value={release.createdBy} />
            <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(release.createdAt)} />
            <MetaRow icon={FileText} label="Description" value={release.description ?? "None"} multiline />
            <MetaRow icon={FileText} label="Notes" value={release.notes ?? "None"} multiline />
            <MetaRow icon={Package} label="Artifact key" value={release.artifact.key} multiline />
            <MetaRow icon={FileText} label="Artifact digest" value={release.artifact.digest} multiline />
            <MetaRow icon={GitBranch} label="Source key" value={release.source?.key ?? "None"} multiline />
            <MetaRow icon={FileText} label="Source digest" value={release.source?.digest ?? "None"} multiline />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="flex items-start gap-2 font-semibold text-slate-700">
                <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                Tags
              </span>
              <TagList tags={release.tags} emptyLabel="No tags" />
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
      <span className={`text-slate-800 ${multiline ? "whitespace-pre-wrap break-words" : "min-w-0 truncate"}`}>{value}</span>
    </div>
  );
}
