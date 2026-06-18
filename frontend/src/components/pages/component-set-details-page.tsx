import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, CalendarClock, FileText, Layers3, PackageCheck, Tag, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { TagList } from "@/components/ui/tag-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listComponentSets, listDeploysets, type ApiComponentSet, type ApiDeploySet } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export function ComponentSetDetailsPage({ componentSetId }: { componentSetId: string }) {
  const query = useQuery({
    queryKey: ["component-sets", "detail", componentSetId],
    queryFn: async () => {
      const [componentSets, deploysets] = await Promise.all([listComponentSets(), listDeploysets()]);
      const componentSet = componentSets.find((entry) => entry.componentSetId === componentSetId);
      return {
        componentSet,
        relatedDeploysets: deploysets.filter((deployset) => deployset.componentSetId === componentSetId),
      };
    },
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading component set details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.componentSet) return <EmptyPanel label={`Component Set ${componentSetId} was not found.`} />;

  return <ComponentSetDetailsView componentSet={query.data.componentSet} relatedDeploysets={query.data.relatedDeploysets} />;
}

function ComponentSetDetailsView({ componentSet, relatedDeploysets }: { componentSet: ApiComponentSet; relatedDeploysets: ApiDeploySet[] }) {
  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={componentSet.componentSetId}
        subtitle="Component membership, metadata, and DeploySet usage."
        action={
          <Link to="/component-sets">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to component sets
            </Button>
          </Link>
        }
      />

      <div className="grid shrink-0 grid-cols-3 gap-4">
        <FactCard icon={Boxes} label="Components" value={String(componentSet.components.length)} sublabel="Included in this set" />
        <FactCard icon={PackageCheck} label="DeploySets" value={String(relatedDeploysets.length)} sublabel="Using this Component Set" />
        <FactCard icon={CalendarClock} label="Created" value={formatDateTime(componentSet.createdAt)} sublabel={`By ${componentSet.createdBy}`} />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollFade className="h-full" contentClassName="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {componentSet.components.map((component) => (
                    <TableRow key={component.componentId}>
                      <TableCell>
                        <EntityLink
                          kind="component"
                          to="/components/$componentId"
                          params={{ componentId: component.componentId }}
                        >
                          {component.componentId}
                        </EntityLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollFade>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Component Set metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={Layers3} label="Component Set" value={componentSet.componentSetId} />
              <MetaRow icon={UserRound} label="Created by" value={componentSet.createdBy} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(componentSet.createdAt)} />
              <MetaRow icon={FileText} label="Description" value={componentSet.description ?? "None"} multiline />
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={componentSet.tags} emptyLabel="No tags" />
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Related DeploySets</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
              <ScrollFade className="h-full" contentClassName="space-y-2 px-4 pb-4">
                {relatedDeploysets.length ? (
                  relatedDeploysets.map((deployset) => (
                    <div
                      key={deployset.deploySetId}
                      className="block rounded-lg bg-white px-3 py-2 transition-colors hover:bg-blue-50/40"
                    >
                      <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: deployset.deploySetId }}>
                        {deployset.deploySetId}
                      </EntityLink>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(deployset.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No DeploySets use this Component Set yet.</p>
                )}
              </ScrollFade>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="h-[116px]">
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

function MetaRow({ icon: Icon, label, value, multiline = false }: { icon: typeof Layers3; label: string; value: ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[130px_1fr] gap-3 ${multiline ? "items-start" : "items-center"}`}>
      <span className={`flex gap-2 font-semibold text-slate-700 ${multiline ? "items-start" : "items-center"}`}>
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className={`text-slate-800 ${multiline ? "whitespace-pre-wrap break-words" : "min-w-0 truncate"}`}>{value}</span>
    </div>
  );
}
