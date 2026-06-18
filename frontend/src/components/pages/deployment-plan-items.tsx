import { EntityLink } from "@/components/ui/entity-link";
import { Network, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { components } from "@/lib/api-types";

export function PlanItems({
  items,
  currentVersions,
}: {
  items: components["schemas"]["DeploymentExecutionItem"][];
  currentVersions: Map<string, string>;
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
              <VersionCell componentId={item.componentId} currentVersion={currentVersions.get(item.componentId)} targetVersion={item.version} />
            </TableCell>
            <TableCell>
              <Badge variant={item.requestedAction === "skip" ? "slate" : "blue"}>
                {item.requestedAction === "skip" ? "No change" : "Deploy"}
              </Badge>
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
}: {
  componentId: string;
  currentVersion: string | undefined;
  targetVersion: string;
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
      <span className="shrink-0 text-slate-400">-&gt;</span>
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
