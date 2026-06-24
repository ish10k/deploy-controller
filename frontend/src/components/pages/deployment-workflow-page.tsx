import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";

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
  listReleases,
  listDeployments,
  listVersions,
  planDeployment,
  queryKeys,
} from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { ENTITY_ICONS } from "@/lib/entity-icons";
import { useModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate";

export function DeploymentWorkflowPage({
  onCreated,
  onCancel,
  onCreateRelease,
  initialEnvironmentId = "",
  lockEnvironment = false,
  initialReleaseId = "",
  lockTarget = false,
  showHeader = true,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
  onCreateRelease?: () => void;
  initialEnvironmentId?: string;
  lockEnvironment?: boolean;
  initialReleaseId?: string;
  lockTarget?: boolean;
  showHeader?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useWorkspaceNavigate();
  const toast = useToast();
  const { openModal, closeModal } = useModal();
  const { environmentId: defaultEnvironmentId, environments, environmentsLoading } = useAppContext();
  const [releaseId, setReleaseId] = useState(initialReleaseId);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(initialEnvironmentId || defaultEnvironmentId);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const [force, setForce] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const releasesQuery = useQuery({ queryKey: queryKeys.releases, queryFn: listReleases });
  const versionsQuery = useQuery({ queryKey: queryKeys.versions(), queryFn: () => listVersions() });
  const executionsQuery = useQuery({
    queryKey: queryKeys.executions(selectedEnvironmentId),
    queryFn: () => listDeployments(selectedEnvironmentId),
    enabled: Boolean(selectedEnvironmentId),
  });
  const requestedBy = "amit.kumar";
  const releaseOptions = releasesQuery.data ?? [];
  const activeReleaseId = releaseId || initialReleaseId || releaseOptions[0]?.releaseId || "";
  const filteredReleases = useMemo(() => {
    if (!activeReleaseId) {
      return releaseOptions;
    }
    return releaseOptions.filter((release) => release.releaseId === activeReleaseId);
  }, [activeReleaseId, releaseOptions]);
  const selectedRelease = useMemo(
    () => filteredReleases.find((release) => release.releaseId === activeReleaseId) ?? null,
    [activeReleaseId, filteredReleases],
  );
  const activeExecution = useMemo(() => {
    if (!selectedEnvironmentId || !selectedRelease) {
      return null;
    }

    return (
      (executionsQuery.data ?? []).find((execution) => {
        if (execution.environmentId !== selectedEnvironmentId) {
          return false;
        }
        if (!["pending", "claimed", "in-progress"].includes(execution.status)) {
          return false;
        }
        return execution.releaseId === selectedRelease.releaseId;
      }) ?? null
    );
  }, [executionsQuery.data, selectedRelease, selectedEnvironmentId]);
  const planQuery = useQuery({
    queryKey: queryKeys.deploymentPlan(selectedEnvironmentId, activeReleaseId, force),
    queryFn: () => planDeployment({ environmentId: selectedEnvironmentId, releaseId: activeReleaseId, force }),
    enabled: Boolean(selectedEnvironmentId && activeReleaseId),
    retry: 1,
  });

  useEffect(() => {
    if (lockEnvironment) {
      setSelectedEnvironmentId(initialEnvironmentId || defaultEnvironmentId);
    }
  }, [defaultEnvironmentId, initialEnvironmentId, lockEnvironment]);

  useEffect(() => {
    if (lockTarget) {
      setReleaseId(initialReleaseId);
    }
  }, [initialReleaseId, initialReleaseId, lockTarget]);

  useEffect(() => {
    if (lockTarget || !releasesQuery.data) {
      return;
    }

    if (!releaseId) {
      return;
    }

    if (!filteredReleases.some((release) => release.releaseId === releaseId)) {
      setReleaseId("");
    }
  }, [releaseId, releasesQuery.data, filteredReleases, lockTarget]);
  const createMutation = useMutation({
    mutationFn: createDeployment,
    onSuccess: async (execution) => {
      closeModal();
      toast({
        variant: "success",
        title: "Deployment created",
        description: `Execution ${execution.deploymentId} is now pending.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.executions() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.environmentCenter }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions }),
      ]);
      onCreated?.();
      await navigate({ to: "/deployments/$deploymentId", params: { deploymentId: execution.deploymentId } });
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
  const versionCreatedAtByKey = useMemo(
    () => new Map((versionsQuery.data ?? []).map((version) => [`${version.componentId}:${version.version}`, version.createdAt])),
    [versionsQuery.data],
  );

  const planPreview = planQuery.data ?? null;
  const changedPlanItems = useMemo(
    () => planPreview?.items.filter((item) => item.requestedAction !== "skip") ?? [],
    [planPreview],
  );
  const tagsError = validateTagDrafts(tags);
  const parsedTags = tagsToRecord(tags);
  const deployDisabled =
    !activeReleaseId ||
    planQuery.isFetching ||
    createMutation.isPending ||
    Boolean(tagsError) ||
    executionsQuery.isFetching ||
    Boolean(activeExecution);
  const showLockedReleaseOption =
    Boolean(activeReleaseId) && !releaseOptions.some((release) => release.releaseId === activeReleaseId);
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
                      releaseId: activeReleaseId,
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
                    <PlanItems items={changedPlanItems} currentVersions={currentVersions} versionCreatedAtByKey={versionCreatedAtByKey} />
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
      {showHeader ? <PageHeader title="Plan Deployment" subtitle="Plan and create a deployment using the current API." /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <ENTITY_ICONS.release className="h-4 w-4 text-slate-500" />
                Release
                <RequiredMark />
              </span>
              <Select
                variant="light"
                value={activeReleaseId}
                onChange={(event) => {
                  setReleaseId(event.target.value);
                  setReleaseId("");
                }}
                disabled={lockTarget || releasesQuery.isLoading || !releasesQuery.data?.length}
              >
                {showLockedReleaseOption ? (
                  <option value={activeReleaseId}>{activeReleaseId}</option>
                ) : null}
                {!releaseOptions.length && !showLockedReleaseOption ? (
                  <option value="" disabled>
                    {releasesQuery.isLoading ? "Loading releases..." : "No releases available"}
                  </option>
                ) : null}
                {releaseOptions.map((release) => (
                  <option key={release.releaseId} value={release.releaseId}>
                    {release.releaseId}
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
          {onCreateRelease && !lockTarget ? (
            <div className="flex justify-start">
              <button type="button" className="flex items-center gap-1 text-left text-xs font-bold text-blue-600" onClick={onCreateRelease}>
                <Plus className="h-3.5 w-3.5" />
                Create new Release
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Plan preview</CardTitle>
            <p className="mt-1 text-xs font-medium text-slate-500">The components and versions to be deployed as part of this Release.</p>
          </div>
        </CardHeader>
        <CardContent>
          {planQuery.isLoading ? (
            <LoadingPanel label="Loading plan preview..." />
          ) : planQuery.error ? (
            <ApiErrorPanel error={planQuery.error} onRetry={() => planQuery.refetch()} />
          ) : planPreview ? (
            <PlanItems items={planPreview.items} currentVersions={currentVersions} versionCreatedAtByKey={versionCreatedAtByKey} />
          ) : (
            <EmptyPanel label="Select a Release and environment to preview the deployment." />
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <TagsCard
          tags={tags}
          error={tagsError}
          resourceType="deployment"
          onReplace={setTags}
          description="Attach metadata to the deployment for audit, filtering, and reporting."
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
            Deployment {activeExecution.deploymentId} is already {activeExecution.status} for this environment and version set.
          </p>
        ) : null}
        <p className="text-xs font-medium text-slate-500">Review the plan before creating a pending deployment.</p>
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






