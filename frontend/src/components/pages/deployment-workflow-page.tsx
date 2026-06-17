import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronDown } from "lucide-react";
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
  planDeployment,
  queryKeys,
} from "@/lib/api-client";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/components/ui/toast";

export function DeploymentWorkflowPage({
  onCreated,
  onCancel,
  showHeader = true,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
  showHeader?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { environmentId: defaultEnvironmentId, environments, environmentsLoading } = useAppContext();
  const [componentSetId, setComponentSetId] = useState("");
  const [deploySetId, setDeploySetId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(defaultEnvironmentId);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const [force, setForce] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const componentSetsQuery = useQuery({ queryKey: queryKeys.componentSets, queryFn: listComponentSets });
  const deploysetsQuery = useQuery({ queryKey: queryKeys.deploysets, queryFn: listDeploysets });
  const executionsQuery = useQuery({
    queryKey: queryKeys.executions(selectedEnvironmentId),
    queryFn: () => listDeploymentExecutions(selectedEnvironmentId),
    enabled: Boolean(selectedEnvironmentId),
  });
  const requestedBy = "amit.kumar";
  const activeComponentSetId = componentSetId || componentSetsQuery.data?.[0]?.componentSetId || "";
  const filteredDeploysets = useMemo(() => {
    const deploysets = deploysetsQuery.data ?? [];
    if (!activeComponentSetId) {
      return deploysets;
    }
    return deploysets.filter((deployset) => deployset.componentSetId === activeComponentSetId);
  }, [activeComponentSetId, deploysetsQuery.data]);
  const activeDeploySetId = deploySetId || filteredDeploysets[0]?.deploySetId || "";
  const planQuery = useQuery({
    queryKey: queryKeys.deploymentPlan(selectedEnvironmentId, activeDeploySetId, force),
    queryFn: () => planDeployment({ environmentId: selectedEnvironmentId, deploySetId: activeDeploySetId, force }),
    enabled: Boolean(selectedEnvironmentId && activeDeploySetId),
    retry: 1,
  });

  useEffect(() => {
    if (!deploySetId) {
      return;
    }

    if (!filteredDeploysets.some((deployset) => deployset.deploySetId === deploySetId)) {
      setDeploySetId("");
    }
  }, [deploySetId, filteredDeploysets]);
  const createMutation = useMutation({
    mutationFn: createDeployment,
    onSuccess: async (execution) => {
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
      await navigate({ to: "/deployments" });
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

  const planPreview = planQuery.data ?? null;
  const tagsError = validateTagDrafts(tags);
  const parsedTags = tagsToRecord(tags);
  const deployDisabled = !activeDeploySetId || planQuery.isFetching || createMutation.isPending || Boolean(tagsError);
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
            createMutation.mutate({
              environmentId: selectedEnvironmentId,
              deploySetId: activeDeploySetId,
              requestedBy,
              notes: notes.trim() || null,
              force,
              tags: parsedTags,
            })
          }
        >
          <CheckCheck className="h-4 w-4" />
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
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            <span>
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
              disabled={componentSetsQuery.isLoading || !componentSetsQuery.data?.length}
            >
              {!componentSetsQuery.data?.length ? (
                <option value="" disabled>
                  {componentSetsQuery.isLoading ? "Loading component sets..." : "No component sets available"}
                </option>
              ) : null}
              {(componentSetsQuery.data ?? []).map((componentSet) => (
                <option key={componentSet.componentSetId} value={componentSet.componentSetId}>
                  {componentSet.componentSetId}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              DeploySet
              <RequiredMark />
            </span>
            <Select variant="light" value={activeDeploySetId} onChange={(event) => setDeploySetId(event.target.value)}>
              {!filteredDeploysets.length ? (
                <option value="" disabled>
                  {deploysetsQuery.isLoading ? "Loading deploysets..." : "No deploysets for this component set"}
                </option>
              ) : null}
              {filteredDeploysets.map((deployset) => (
                <option key={deployset.deploySetId} value={deployset.deploySetId}>
                  {deployset.deploySetId}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              Environment
              <RequiredMark />
            </span>
            <Select
              variant="light"
              value={selectedEnvironmentId}
              onChange={(event) => setSelectedEnvironmentId(event.target.value)}
              disabled={environmentsLoading || !environments.length}
            >
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
            <PlanItems items={planPreview.items} currentVersions={currentVersions} />
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
      <p className="text-xs font-medium text-slate-500">Review the plan before creating a pending deployment execution.</p>
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
