import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { ResourceContent } from "@/components/pages/resource-content";
import { Field } from "@/components/pages/resource-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  claimExecution,
  listPendingExecutions,
  queryKeys,
  reportExecutionItemStatus,
  reportExecutionStatus,
  type ApiDeploymentExecution,
} from "@/lib/api-client";
import type { components } from "@/lib/api-types";

type AdapterDialogKind = "claim" | "executionStatus" | "itemStatus";

export function AdaptersPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ApiDeploymentExecution | null>(null);
  const [dialog, setDialog] = useState<AdapterDialogKind | null>(null);
  const query = useQuery({ queryKey: queryKeys.pendingExecutions, queryFn: listPendingExecutions });
  const claimMutation = useMutation({
    mutationFn: ({ id, claimedBy }: { id: string; claimedBy: string }) => claimExecution(id, claimedBy),
    onSuccess: async (execution) => {
      setSelected(execution);
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: components["schemas"]["ExecutionStatus"] }) => reportExecutionStatus(id, status),
    onSuccess: async (execution) => {
      setSelected(execution);
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions });
    },
  });
  const itemMutation = useMutation({
    mutationFn: ({
      executionId,
      componentId,
      request,
    }: {
      executionId: string;
      componentId: string;
      request: components["schemas"]["ReportExecutionItemStatusRequest"];
    }) => reportExecutionItemStatus(executionId, componentId, request),
    onSuccess: async (execution) => {
      setSelected(execution);
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions });
    },
  });

  return (
    <>
      <PageHeader title="Adapters" subtitle="Pending execution queue and adapter reporting actions." />
      <ResourceContent
        query={query}
        rows={query.data ?? []}
        selected={selected}
        onSelect={setSelected}
        columns={["Execution", "DeploySet", "Environment", "Status", "Items"]}
        renderRow={(execution) => [
          execution.deploymentExecutionId,
          execution.deploySetId,
          execution.environmentId,
          <StatusBadge status={execution.status} />,
          execution.items.length,
        ]}
      />
      {selected ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Adapter actions</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialog("claim")}>
                Claim
              </Button>
              <Button variant="outline" onClick={() => setDialog("executionStatus")}>
                Report status
              </Button>
              <Button variant="outline" onClick={() => setDialog("itemStatus")}>
                Report item
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}
      <AdapterDialog
        kind={dialog}
        execution={selected}
        onClose={() => setDialog(null)}
        onClaim={(claimedBy) => selected && claimMutation.mutate({ id: selected.deploymentExecutionId, claimedBy })}
        onStatus={(status) => selected && statusMutation.mutate({ id: selected.deploymentExecutionId, status })}
        onItem={(componentId, request) =>
          selected && itemMutation.mutate({ executionId: selected.deploymentExecutionId, componentId, request })
        }
      />
    </>
  );
}

function AdapterDialog({
  kind,
  execution,
  onClose,
  onClaim,
  onStatus,
  onItem,
}: {
  kind: AdapterDialogKind | null;
  execution: ApiDeploymentExecution | null;
  onClose: () => void;
  onClaim: (claimedBy: string) => void;
  onStatus: (status: components["schemas"]["ExecutionStatus"]) => void;
  onItem: (componentId: string, request: components["schemas"]["ReportExecutionItemStatusRequest"]) => void;
}) {
  const [claimedBy, setClaimedBy] = useState("k8s-adapter-1");
  const [status, setStatus] = useState<components["schemas"]["ExecutionStatus"]>("running");
  const [componentId, setComponentId] = useState("");
  const [reportedBy, setReportedBy] = useState("k8s-adapter-1");
  const [itemStatus, setItemStatus] = useState<components["schemas"]["ItemStatus"]>("running");
  const [reportedAction, setReportedAction] = useState<components["schemas"]["ReportedAction"]>("deploy");

  if (!execution) return null;

  return (
    <Modal open={Boolean(kind)} title="Adapter action" onClose={onClose}>
      <div className="space-y-3 p-4">
        {kind === "claim" ? (
          <>
            <Field label="Claimed by" value={claimedBy} onChange={setClaimedBy} />
            <Button onClick={() => onClaim(claimedBy)}>Claim execution</Button>
          </>
        ) : null}
        {kind === "executionStatus" ? (
          <>
            <Select variant="light" value={status} onChange={(event) => setStatus(event.target.value as components["schemas"]["ExecutionStatus"])}>
              {["pending", "claimed", "running", "succeeded", "failed", "cancelled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Button onClick={() => onStatus(status)}>Report status</Button>
          </>
        ) : null}
        {kind === "itemStatus" ? (
          <>
            <Select variant="light" value={componentId} onChange={(event) => setComponentId(event.target.value)}>
              <option value="">Select component</option>
              {execution.items.map((item) => (
                <option key={item.componentId} value={item.componentId}>
                  {item.componentId}
                </option>
              ))}
            </Select>
            <Field label="Reported by" value={reportedBy} onChange={setReportedBy} />
            <Select variant="light" value={itemStatus} onChange={(event) => setItemStatus(event.target.value as components["schemas"]["ItemStatus"])}>
              {["pending", "running", "succeeded", "failed", "skipped"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              variant="light"
              value={reportedAction}
              onChange={(event) => setReportedAction(event.target.value as components["schemas"]["ReportedAction"])}
            >
              {["deploy", "noop", "skip"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Button
              disabled={!componentId}
              onClick={() =>
                onItem(componentId, {
                  status: itemStatus,
                  reportedAction,
                  reportedBy,
                  adapterReason: null,
                  message: null,
                  error: null,
                })
              }
            >
              Report item
            </Button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
