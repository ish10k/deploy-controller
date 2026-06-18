import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { PlanItems } from "@/components/pages/deployment-plan-items";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotesCard } from "@/components/ui/notes-card";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import {
  createDeployment,
  listComponentSets,
  listDeploymentExecutions,
  listDeploysets,
  listReleases,
  planDeployment,
  queryKeys,
} from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { useModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function DeploymentWorkflowPage({
  onCreated,
  onCancel,
  onCreateDeploySet,
  initialEnvironmentId = "",
  lockEnvironment = false,
  initialComponentSetId = "",
  initialDeploySetId = "",
  lockTarget = false,
  showHeader = true,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
  onCreateDeploySet?: () => void;
  initialEnvironmentId?: string;
  lockEnvironment?: boolean;
  initialComponentSetId?: string;
  initialDeploySetId?: string;
  lockTarget?: boolean;
  showHeader?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { openModal, closeModal } = useModal();
  const { environmentId: defaultEnvironmentId, environments, environmentsLoading } = useAppContext();
  const [componentSetId, setComponentSetId] = useState(initialComponentSetId);
  const [deploySetId, setDeploySetId] = useState(initialDeploySetId);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(initialEnvironmentId || defaultEnvironmentId);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const [force, setForce] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const componentSetsQuery = useQuery({ queryKey: queryKeys.componentSets, queryFn: listComponentSets });
  const deploysetsQuery = useQuery({ queryKey: queryKeys.deploysets, queryFn: listDeploysets });
  const releasesQuery = useQuery({ queryKey: queryKeys.releases(), queryFn: () => listReleases() });
  const executionsQuery = useQuery({
    queryKey: queryKeys.executions(selectedEnvironmentId),
    queryFn: () => listDeploymentExecutions(selectedEnvironmentId),
    enabled: Boolean(selectedEnvironmentId),
  });
  const requestedBy = "amit.kumar";
  const activeComponentSetId = componentSetId || initialComponentSetId || componentSetsQuery.data?.[0]?.componentSetId || "";
  const filteredDeploysets = useMemo(() => {
    const deploysets = deploysetsQuery.data ?? [];
    if (!activeComponentSetId) {
      return deploysets;
    }
    return deploysets.filter((deployset) => deployset.componentSetId === activeComponentSetId);
  }, [activeComponentSetId, deploysetsQuery.data]);
  const activeDeploySetId = deploySetId || initialDeploySetId || filteredDeploysets[0]?.deploySetId || "";
  const deploysetOptions = useMemo(() => {
    if (!activeDeploySetId || filteredDeploysets.some((deployset) => deployset.deploySetId === activeDeploySetId)) {
      return filteredDeploysets;
    }
    const current = (deploysetsQuery.data ?? []).find((deployset) => deployset.deploySetId === activeDeploySetId);
    return current ? [current, ...filteredDeploysets] : filteredDeploysets;
  }, [activeDeploySetId, deploysetsQuery.data, filteredDeploysets]);
  const selectedDeployset = useMemo(
    () => filteredDeploysets.find((deployset) => deployset.deploySetId === activeDeploySetId) ?? null,
    [activeDeploySetId, filteredDeploysets],
  );
  const deploysetComponentSetIds = useMemo(() => {
    return new Map((deploysetsQuery.data ?? []).map((deployset) => [deployset.deploySetId, deployset.componentSetId]));
  }, [deploysetsQuery.data]);
  const activeExecution = useMemo(() => {
    if (!selectedEnvironmentId || !selectedDeployset) {
      return null;
    }

    return (
      (executionsQuery.data ?? []).find((execution) => {
        if (execution.environmentId !== selectedEnvironmentId) {
          return false;
        }
        if (!["pending", "claimed", "running"].includes(execution.status)) {
          return false;
        }
        return deploysetComponentSetIds.get(execution.deploySetId) === selectedDeployset.componentSetId;
      }) ?? null
    );
  }, [deploysetComponentSetIds, executionsQuery.data, selectedDeployset, selectedEnvironmentId]);
  const planQuery = useQuery({
    queryKey: queryKeys.deploymentPlan(selectedEnvironmentId, activeDeploySetId, force),
    queryFn: () => planDeployment({ environmentId: selectedEnvironmentId, deploySetId: activeDeploySetId, force }),
    enabled: Boolean(selectedEnvironmentId && activeDeploySetId),
    retry: 1,
  });

  useEffect(() => {
    if (lockEnvironment) {
      setSelectedEnvironmentId(initialEnvironmentId || defaultEnvironmentId);
    }
  }, [defaultEnvironmentId, initialEnvironmentId, lockEnvironment]);

  useEffect(() => {
    if (lockTarget) {
      setComponentSetId(initialComponentSetId);
      setDeploySetId(initialDeploySetId);
    }
  }, [initialComponentSetId, initialDeploySetId, lockTarget]);

  useEffect(() => {
    if (lockTarget || !deploysetsQuery.data) {
      return;
    }

    if (!deploySetId) {
      return;
    }

    if (!filteredDeploysets.some((deployset) => deployset.deploySetId === deploySetId)) {
      setDeploySetId("");
    }
  }, [deploySetId, deploysetsQuery.data, filteredDeploysets, lockTarget]);
  const createMutation = useMutation({
    mutationFn: createDeployment,
    onSuccess: async (execution) => {
      closeModal();
      toast({
        variant: "success",
        title: "Deployment created",
        description: `Execution ${execution.deploymentExecutionId} is now pending.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.executions(selectedEnvironmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedEnvironmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions }),
      ]);
      onCreated?.();
      await navigate({ to: "/deployments/$deploymentExecutionId", params: { deploymentExecutionId: execution.deploymentExecutionId } });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "Unable to create deployment.",
      });
    },
  });

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const currentVersions = useMemo(() => {
    const latestExecution = [...(executionsQuery.data ?? [])].sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
    )[0];
    return new Map(latestExecution?.items.map((item) => [item.componentId, item.version]));
  }, [executionsQuery.data]);
  const releaseCreatedAtByKey = useMemo(
    () => new Map((releasesQuery.data ?? []).map((release) => [`${release.componentId}:${release.version}`, release.createdAt])),
    [releasesQuery.data],
  );

  const planPreview = planQuery.data ?? null;
  const changedPlanItems = useMemo(
    () => planPreview?.items.filter((item) => item.requestedAction !== "skip") ?? [],
    [planPreview],
  );
  const tagsError = validateTagDrafts(tags);
  const parsedTags = tagsToRecord(tags);
  const deployDisabled =
    !activeDeploySetId ||
    planQuery.isFetching ||
    createMutation.isPending ||
    Boolean(tagsError) ||
    executionsQuery.isFetching ||
    Boolean(activeExecution);
  const componentSetOptions = componentSetsQuery.data ?? [];
  const showLockedComponentSetOption =
    Boolean(activeComponentSetId) && !componentSetOptions.some((componentSet) => componentSet.componentSetId === activeComponentSetId);
  const showLockedDeploySetOption =
    Boolean(activeDeploySetId) && !deploysetOptions.some((deployset) => deployset.deploySetId === activeDeploySetId);
  const showLockedEnvironmentOption =
    Boolean(selectedEnvironmentId) && !environments.some((environment) => environment.environmentId === selectedEnvironmentId);
  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };
  const deployButton = (
    <div ref={actionsRef} className="relative flex justify-end">
      <div className="inline-flex">
        <Button
          disabled={deployDisabled}
          className="rounded-r-none"
          onClick={() =>
            openModal({
              title: "Confirm deployment",
              description: "Review the changed deploys before creating the execution.",
              maxWidth: "max-w-4xl",
              footer: (
                <DeploymentConfirmFooter
                  changedCount={changedPlanItems.length}
                  onCancel={closeModal}
                  onConfirm={() =>
                    createMutation.mutateAsync({
                      environmentId: selectedEnvironmentId,
                      deploySetId: activeDeploySetId,
                      requestedBy,
                      notes: notes.trim() || null,
                      force,
                      tags: parsedTags,
                    })
                  }
                  confirmDisabled={!planPreview}
                />
              ),
              render: () => (
                <div className="grid gap-4">
                  {planQuery.isLoading ? (
                    <LoadingPanel label="Loading plan preview..." />
                  ) : planQuery.error ? (
                    <ApiErrorPanel error={planQuery.error} onRetry={() => planQuery.refetch()} />
                  ) : changedPlanItems.length > 0 ? (
                    <PlanItems items={changedPlanItems} currentVersions={currentVersions} releaseCreatedAtByKey={releaseCreatedAtByKey} />
                  ) : (
                    <EmptyPanel label="No components need to change for this deployment." />
                  )}
                </div>
              ),
            })
          }
          >
          <Check className="h-4 w-4" />
          Deploy
        </Button>
        <Button
          type="button"
          className="rounded-l-none border-l border-white/15 px-2 shadow-sm"
          aria-expanded={actionsOpen}
          aria-haspopup="menu"
          title="More deployment actions"
          onClick={() => setActionsOpen((value) => !value)}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>
      {actionsOpen ? (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-panel">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setForce((value) => !value);
              setActionsOpen(false);
            }}
          >
            <span>Force deployment</span>
            <input type="checkbox" checked={force} readOnly className="pointer-events-none h-4 w-4 accent-blue-600" />
          </button>
          <div className="px-3 pb-1 text-xs text-slate-500">Bypass the version check and redeploy even when the latest execution already matches.</div>
        </div>
      ) : null}
    </div>
  );
  const content = (
    <>
      {showHeader ? <PageHeader title="Plan Deployment" subtitle="Plan and create a deployment execution using the current API." /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <ENTITY_ICONS.componentSet className="h-4 w-4 text-slate-500" />
                Component Set
                <RequiredMark />
              </span>
              <Select
                variant="light"
                value={activeComponentSetId}
                onChange={(event) => {
                  setComponentSetId(event.target.value);
                  setDeploySetId("");
                }}
                disabled={lockTarget || componentSetsQuery.isLoading || !componentSetsQuery.data?.length}
              >
                {showLockedComponentSetOption ? (
                  <option value={activeComponentSetId}>{activeComponentSetId}</option>
                ) : null}
                {!componentSetOptions.length && !showLockedComponentSetOption ? (
                  <option value="" disabled>
                    {componentSetsQuery.isLoading ? "Loading component sets..." : "No component sets available"}
                  </option>
                ) : null}
                {componentSetOptions.map((componentSet) => (
                  <option key={componentSet.componentSetId} value={componentSet.componentSetId}>
                    {componentSet.componentSetId}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <ENTITY_ICONS.deployset className="h-4 w-4 text-slate-500" />
                DeploySet
                <RequiredMark />
              </span>
              <Select variant="light" value={activeDeploySetId} onChange={(event) => setDeploySetId(event.target.value)} disabled={lockTarget}>
                {showLockedDeploySetOption ? (
                  <option value={activeDeploySetId}>{activeDeploySetId}</option>
                ) : null}
                {!deploysetOptions.length && !showLockedDeploySetOption ? (
                  <option value="" disabled>
                    {deploysetsQuery.isLoading ? "Loading deploysets..." : "No deploysets for this component set"}
                  </option>
                ) : null}
                {deploysetOptions.map((deployset) => (
                  <option key={deployset.deploySetId} value={deployset.deploySetId}>
                    {deployset.deploySetId}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <ENTITY_ICONS.environment className="h-4 w-4 text-slate-500" />
                Environment
                <RequiredMark />
              </span>
              <Select
                variant="light"
                value={selectedEnvironmentId}
                onChange={(event) => setSelectedEnvironmentId(event.target.value)}
                disabled={lockEnvironment || environmentsLoading || !environments.length}
              >
                {showLockedEnvironmentOption ? <option value={selectedEnvironmentId}>{selectedEnvironmentId}</option> : null}
                {!environments.length ? (
                  <option value="" disabled>
                    {environmentsLoading ? "Loading environments..." : "No environments available"}
                  </option>
                ) : null}
                {environments.map((environment) => (
                  <option key={environment.environmentId} value={environment.environmentId}>
                    {environment.environmentId}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {onCreateDeploySet && !lockTarget ? (
            <div className="flex justify-start">
              <button type="button" className="flex items-center gap-1 text-left text-xs font-bold text-blue-600" onClick={onCreateDeploySet}>
                <Plus className="h-3.5 w-3.5" />
                Create new DeploySet
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Plan preview</CardTitle>
            <p className="mt-1 text-xs font-medium text-slate-500">The components and versions to be deployed as part of this DeploySet.</p>
          </div>
        </CardHeader>
        <CardContent>
          {planQuery.isLoading ? (
            <LoadingPanel label="Loading plan preview..." />
          ) : planQuery.error ? (
            <ApiErrorPanel error={planQuery.error} onRetry={() => planQuery.refetch()} />
          ) : planPreview ? (
            <PlanItems items={planPreview.items} currentVersions={currentVersions} releaseCreatedAtByKey={releaseCreatedAtByKey} />
          ) : (
            <EmptyPanel label="Select a DeploySet and environment to preview the deployment." />
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <TagsCard
          tags={tags}
          error={tagsError}
          description="Attach metadata to the deployment execution for audit, filtering, and reporting."
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>

      <div className="mt-4">
        <NotesCard
          value={notes}
          onChange={setNotes}
          title="Deployment notes"
          description="Add optional rollout notes, approvals, or operator context."
          placeholder="Optional rollout notes, approvals, or operator context."
        />
      </div>
    </>
  );
  const footer = (
    <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
      <div className="grid gap-1">
        {activeExecution ? (
          <p className="text-xs font-semibold text-red-700">
            Deployment {activeExecution.deploymentExecutionId} is already {activeExecution.status} for this environment and component set.
          </p>
        ) : null}
        <p className="text-xs font-medium text-slate-500">Review the plan before creating a pending deployment execution.</p>
      </div>
      <div className="flex items-center gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {deployButton}
      </div>
    </div>
  );
  if (!showHeader) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{content}</div>
        {footer}
      </div>
    );
  }

  return (
    <>
      {content}
      <div className="mt-4 rounded-lg border border-slate-200">{footer}</div>
    </>
  );
}

function DeploymentConfirmFooter({
  changedCount,
  onCancel,
  onConfirm,
  confirmDisabled,
}: {
  changedCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<unknown>;
  confirmDisabled: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="grid gap-0.5">
        <p className="text-xs font-medium text-slate-500">
          {changedCount > 0
            ? `${changedCount} changed deploy${changedCount === 1 ? "" : "s"} will be created.`
            : "No changed deploys were found in the current plan."}
        </p>
        <p className="text-xs text-slate-500">The confirmation view only shows items that will actually deploy.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
            } finally {
              setPending(false);
            }
          }}
          disabled={pending || confirmDisabled}
        >
          <Check className="h-4 w-4" />
          Create deployment
        </Button>
      </div>
    </div>
  );
}
