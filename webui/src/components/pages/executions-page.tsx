import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { ResourceContent } from "@/components/pages/resource-content";
import { listDeployments, queryKeys, type ApiDeployment } from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { formatRelativeTime } from "@/lib/format";

export function ExecutionsPage() {
  const { environmentId } = useAppContext();
  const [selected, setSelected] = useState<ApiDeployment | null>(null);
  const query = useQuery({ queryKey: queryKeys.executions(environmentId), queryFn: () => listDeployments(environmentId) });

  return (
    <>
      <PageHeader title="Deployment Executions" subtitle={`Execution history for ${environmentId}.`} />
      <ResourceContent
        query={query}
        rows={query.data ?? []}
        selected={selected}
        onSelect={setSelected}
        columns={["Execution", "Release", "Status", "Started", "Updated"]}
        renderRow={(execution) => [
          execution.deploymentId,
          execution.releaseId,
          <StatusBadge status={execution.status} />,
          formatRelativeTime(execution.startedAt, { mode: "short" }),
          formatRelativeTime(execution.completedAt ?? execution.startedAt, { mode: "short" }),
        ]}
      />
    </>
  );
}



