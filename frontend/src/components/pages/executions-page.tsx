import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { ResourceContent } from "@/components/pages/resource-content";
import { listDeploymentExecutions, queryKeys, type ApiDeploymentExecution } from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { formatRelativeTime } from "@/lib/format";

export function ExecutionsPage() {
  const { environmentId } = useAppContext();
  const [selected, setSelected] = useState<ApiDeploymentExecution | null>(null);
  const query = useQuery({ queryKey: queryKeys.executions(environmentId), queryFn: () => listDeploymentExecutions(environmentId) });

  return (
    <>
      <PageHeader title="Deployment Executions" subtitle={`Execution history for ${environmentId}.`} />
      <ResourceContent
        query={query}
        rows={query.data ?? []}
        selected={selected}
        onSelect={setSelected}
        columns={["Execution", "DeploySet", "Status", "Started", "Claimed By"]}
        renderRow={(execution) => [
          execution.deploymentExecutionId,
          execution.deploySetId,
          <StatusBadge status={execution.status} />,
          formatRelativeTime(execution.startedAt, { mode: "short" }),
          execution.claimedBy ?? "-",
        ]}
      />
    </>
  );
}
