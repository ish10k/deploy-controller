import { EntityLink } from "@/components/ui/entity-link";
import { AlertTriangle, MoveRight } from "lucide-react";

import { RequestedActionBadge } from "@/components/deployments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { components } from "@/lib/api-types";

export function PlanItems({
  items,
  currentVersions,
  versionCreatedAtByKey,
}: {
  items: components["schemas"]["DeploymentItem"][];
  currentVersions: Map<string, string>;
  versionCreatedAtByKey: Map<string, string>;
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
              <div className="flex flex-wrap items-center gap-1">
                <span>{item.componentId}</span>
                {item.runnerMatchWarning ? (
                  <span
                    aria-label="No matching runner found"
                    title="No matching runner found"
                    className="inline-flex h-4 w-4 items-center justify-center text-yellow-600"
                  >
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="font-medium text-slate-700">
              <VersionCell
                componentId={item.componentId}
                currentVersion={currentVersions.get(item.componentId)}
                targetVersion={item.version}
                versionCreatedAtByKey={versionCreatedAtByKey}
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
  versionCreatedAtByKey,
}: {
  componentId: string;
  currentVersion: string | undefined;
  targetVersion: string;
  versionCreatedAtByKey: Map<string, string>;
}) {
  if (!currentVersion || currentVersion === targetVersion) {
    return (
      <EntityLink kind="version" to={"/versions/$componentId/$version" as never} params={{ componentId, version: targetVersion }}>
        {targetVersion}
      </EntityLink>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <EntityLink
        kind="version"
        to={"/versions/$componentId/$version" as never}
        params={{ componentId, version: currentVersion }}
      >
        {currentVersion}
      </EntityLink>
      <ArrowIndicator
        currentCreatedAt={versionCreatedAtByKey.get(`${componentId}:${currentVersion}`)}
        targetCreatedAt={versionCreatedAtByKey.get(`${componentId}:${targetVersion}`)}
      />
      <EntityLink
        kind="version"
        to={"/versions/$componentId/$version" as never}
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


