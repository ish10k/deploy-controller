import { EntityLink } from "@/components/ui/entity-link";
import { MoveRight } from "lucide-react";

import { RequestedActionBadge } from "@/components/deployments/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { components } from "@/lib/api-types";

export function PlanItems({
  items,
  currentVersions,
  releaseCreatedAtByKey,
}: {
  items: components["schemas"]["DeploymentExecutionItem"][];
  currentVersions: Map<string, string>;
  releaseCreatedAtByKey: Map<string, string>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Requested Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.componentId}>
            <TableCell className="font-semibold">
              {item.componentId}
            </TableCell>
            <TableCell className="font-medium text-slate-700">
              <VersionCell
                componentId={item.componentId}
                currentVersion={currentVersions.get(item.componentId)}
                targetVersion={item.version}
                releaseCreatedAtByKey={releaseCreatedAtByKey}
              />
            </TableCell>
            <TableCell>
              <RequestedActionBadge action={item.requestedAction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function VersionCell({
  componentId,
  currentVersion,
  targetVersion,
  releaseCreatedAtByKey,
}: {
  componentId: string;
  currentVersion: string | undefined;
  targetVersion: string;
  releaseCreatedAtByKey: Map<string, string>;
}) {
  if (!currentVersion || currentVersion === targetVersion) {
    return (
      <EntityLink kind="release" to="/releases/$componentId/$version" params={{ componentId, version: targetVersion }}>
        {targetVersion}
      </EntityLink>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <EntityLink
        kind="release"
        to="/releases/$componentId/$version"
        params={{ componentId, version: currentVersion }}
      >
        {currentVersion}
      </EntityLink>
      <ArrowIndicator
        currentCreatedAt={releaseCreatedAtByKey.get(`${componentId}:${currentVersion}`)}
        targetCreatedAt={releaseCreatedAtByKey.get(`${componentId}:${targetVersion}`)}
      />
      <EntityLink
        kind="release"
        to="/releases/$componentId/$version"
        params={{ componentId, version: targetVersion }}
      >
        {targetVersion}
      </EntityLink>
    </div>
  );
}

function ArrowIndicator({
  currentCreatedAt,
  targetCreatedAt,
}: {
  currentCreatedAt: string | undefined;
  targetCreatedAt: string | undefined;
}) {
  const currentTime = currentCreatedAt ? new Date(currentCreatedAt).getTime() : null;
  const targetTime = targetCreatedAt ? new Date(targetCreatedAt).getTime() : null;
  const className =
    currentTime !== null && targetTime !== null
      ? targetTime > currentTime
        ? "text-emerald-600"
        : targetTime < currentTime
          ? "text-red-600"
          : "text-slate-400"
      : "text-slate-400";

  return <MoveRight className={`h-4 w-4 shrink-0 ${className}`} />;
}
