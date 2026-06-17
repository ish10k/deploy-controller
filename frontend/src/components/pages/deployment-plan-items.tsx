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
              <VersionDiff currentVersion={currentVersions.get(item.componentId)} targetVersion={item.version} />
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

function VersionDiff({ currentVersion, targetVersion }: { currentVersion: string | undefined; targetVersion: string }) {
  if (!currentVersion || currentVersion === targetVersion) {
    return <span className="text-slate-900">{targetVersion}</span>;
  }

  return (
    <span>
      {currentVersion} -&gt; <span className="font-bold text-blue-900">{targetVersion}</span>
    </span>
  );
}

export function formatVersion(currentVersion: string | undefined, targetVersion: string) {
  if (!currentVersion || currentVersion === targetVersion) {
    return targetVersion;
  }
  return `${currentVersion} -> ${targetVersion}`;
}
