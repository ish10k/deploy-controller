import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, LayoutGrid, Filter, RefreshCcw, Search, Tags } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingOverlay, LoadingPanel, PageHeader, useMinimumVisible } from "@/components/common/api-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTagDefinitions, queryKeys, type ApiTagDefinition } from "@/lib/api-client";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import type { TagResourceType } from "@/lib/api-types";

const RESOURCE_TYPE_LABELS: Record<TagResourceType, string> = {
  organization: "Organization",
  workspace: "Workspace",
  component: "Component",
  "release-set": "ReleaseSet",
  release: "Release",
  deployment: "Deployment",
  environment: "Environment",
  "deployment-runner": "Runner",
  publisher: "Publisher",
  principal: "Principal",
  webhook: "Webhook",
};

const RESOURCE_TYPE_OPTIONS: Array<{ value: "all" | TagResourceType; label: string }> = [
  { value: "all", label: "All resources" },
  { value: "component", label: "Component" },
  { value: "release-set", label: "ReleaseSet" },
  { value: "release", label: "Release" },
  { value: "environment", label: "Environment" },
  { value: "deployment", label: "Deployment" },
  { value: "deployment-runner", label: "Runner" },
  { value: "publisher", label: "Publisher" },
  { value: "webhook", label: "Webhook" },
  { value: "workspace", label: "Workspace" },
  { value: "principal", label: "Principal" },
  { value: "organization", label: "Organization" },
];

type ResourceFilter = (typeof RESOURCE_TYPE_OPTIONS)[number]["value"];

export function TagsPage() {
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ApiTagDefinition | null>(null);
  const resourceType = resourceFilter === "all" ? undefined : resourceFilter;
  const query = useQuery({
    queryKey: queryKeys.tagDefinitions(resourceType),
    queryFn: () => listTagDefinitions(resourceType),
  });
  const refreshing = useMinimumVisible(query.isFetching && !query.isLoading);

  const definitions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (query.data ?? [])
      .filter((definition) => {
        if (!normalizedSearch) {
          return true;
        }
        return [definition.key, definition.description ?? "", definition.defaultValue ?? "", definition.allowedValues?.join(" ") ?? "", definition.selector?.resourceTypes?.join(" ") ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => left.key.localeCompare(right.key));
  }, [query.data, search]);

  if (query.isLoading) {
    return <LoadingPanel label="Loading tag definitions..." />;
  }
  if (query.error) {
    return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="Tags"
        subtitle="Workspace metadata definitions used by forms, filters, and resource governance."
        action={
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-3 md:grid-cols-[260px_minmax(280px,1fr)]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              Resource type
            </span>
            <Select variant="light" value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value as ResourceFilter)}>
              {RESOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              Search
            </span>
            <Input value={search} placeholder="Search key, value, or description" onChange={(event) => setSearch(event.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-3">
          {refreshing ? <LoadingOverlay /> : null}
          {definitions.length ? <TagDefinitionsTable definitions={definitions} onSelect={setSelected} /> : <EmptyPanel label="No tag definitions match the current filters." />}
        </CardContent>
      </Card>

      <TagDefinitionDrawer definition={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function TagDefinitionsTable({ definitions, onSelect }: { definitions: ApiTagDefinition[]; onSelect: (definition: ApiTagDefinition) => void }) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-white">
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Applies To</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {definitions.map((definition) => (
          <TableRow key={definition.key} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(definition)}>
            <TableCell>
              <div className="flex items-center gap-2 font-semibold text-slate-950">
                <Tags className="h-4 w-4 text-slate-500" />
                {definition.key}
              </div>
            </TableCell>
            <TableCell className="max-w-[360px] whitespace-normal text-xs leading-5 text-slate-600">{definition.description ?? "-"}</TableCell>
            <TableCell>
              <ResourceTypeBadges resourceTypes={definition.selector?.resourceTypes ?? []} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TagDefinitionDrawer({ definition, onClose }: { definition: ApiTagDefinition | null; onClose: () => void }) {
  return (
    <SideDrawer open={Boolean(definition)} title={definition?.key ?? "Tag definition"} description={definition?.description ?? "Workspace tag definition."} maxWidth="max-w-[720px]" onClose={onClose}>
      {definition ? (
        <Card>
          <CardHeader>
            <CardTitle>Definition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0">
            <DetailRow label="Key" value={definition.key} />
            <DetailRow label="Applies to" value={<ResourceTypeBadges resourceTypes={definition.selector?.resourceTypes ?? []} />} />
            <DetailRow label="Default" value={<TagValueList values={definition.defaultValue ? [definition.defaultValue] : []} emptyLabel="-" />} />
            <DetailRow label="Allowed values" value={<TagValueList values={definition.allowedValues ?? []} emptyLabel="Any value" />} />
            <DetailRow label="Description" value={definition.description ?? "-"} />
          </CardContent>
        </Card>
      ) : null}
    </SideDrawer>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="min-w-0 break-words text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function ResourceTypeBadges({ resourceTypes, limit }: { resourceTypes: TagResourceType[]; limit?: number }) {
  if (!resourceTypes.length) {
    return <span className="text-sm text-slate-500">All resource types</span>;
  }

  const visible = limit ? resourceTypes.slice(0, limit) : resourceTypes;
  const hidden = limit ? resourceTypes.length - visible.length : 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((resourceType) => {
        const Icon = RESOURCE_TYPE_ICONS[resourceType];
        return (
          <Badge key={resourceType} variant="slate">
            <span className="inline-flex items-center gap-1.5">
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
              <span>{RESOURCE_TYPE_LABELS[resourceType] ?? resourceType}</span>
            </span>
          </Badge>
        );
      })}
      {hidden > 0 ? <Badge variant="blue">+{hidden}</Badge> : null}
    </div>
  );
}

const RESOURCE_TYPE_ICONS: Partial<Record<TagResourceType, typeof Building2>> = {
  organization: Building2,
  workspace: LayoutGrid,
  component: ENTITY_ICONS.component,
  "release-set": ENTITY_ICONS.releaseSet,
  release: ENTITY_ICONS.release,
  deployment: ENTITY_ICONS.deployment,
  environment: ENTITY_ICONS.environment,
  "deployment-runner": ENTITY_ICONS.runner,
  publisher: ENTITY_ICONS.publisher,
  principal: ENTITY_ICONS.user,
  webhook: ENTITY_ICONS.webhook,
};

function TagValueList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  if (!values.length) {
    return <span className="text-sm text-slate-800">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge key={value} variant="slate">
          {value}
        </Badge>
      ))}
    </div>
  );
}










