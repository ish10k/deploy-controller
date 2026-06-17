import type {
  ApiClaimExecutionRequest,
  ApiComponent,
  ApiComponentSet,
  ApiCreateDeploymentRequest,
  ApiCreateDeploymentResponse,
  ApiDeploySet,
  ApiDeploySetCreateRequest,
  ApiDeploySetCreateResult,
  ApiDeploymentExecution,
  ApiDeploymentPlan,
  ApiEnvironment,
  ApiEnvironmentState,
  ApiPlanDeploymentRequest,
  ApiRelease,
  ApiReportExecutionItemStatusRequest,
  ApiReportExecutionStatusRequest,
} from "@/lib/api-types";

const API_BASE = "/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const queryKeys = {
  components: ["components"] as const,
  componentSets: ["component-sets"] as const,
  releases: (componentId?: string) => ["releases", componentId ?? "all"] as const,
  deploysets: ["deploysets"] as const,
  deployset: (deploySetId: string) => ["deploysets", deploySetId] as const,
  environments: ["environments"] as const,
  environmentState: ["environment-state"] as const,
  environmentCenter: ["environment-center"] as const,
  executions: (environmentId?: string) => ["deployment-executions", environmentId ?? "all"] as const,
  execution: (deploymentExecutionId: string) => ["deployment-executions", deploymentExecutionId] as const,
  deploymentPlan: (environmentId: string, deploySetId: string, force: boolean) =>
    ["deployment-plan", environmentId || "none", deploySetId || "none", force ? "force" : "normal"] as const,
  dashboard: (environmentId: string) => ["dashboard", environmentId] as const,
  pendingExecutions: ["adapter-pending-executions"] as const,
} as const;

export async function listComponents() {
  return request<ApiComponent[]>("/components");
}

export async function getComponent(componentId: string) {
  return request<ApiComponent>(`/components/${encodeURIComponent(componentId)}`);
}

export async function putComponent(componentId: string, component: ApiComponent) {
  return request<ApiComponent>(`/components/${encodeURIComponent(componentId)}`, {
    method: "PUT",
    body: component,
  });
}

export async function listComponentSets() {
  return request<ApiComponentSet[]>("/component-sets");
}

export async function getComponentSet(componentSetId: string) {
  return request<ApiComponentSet>(`/component-sets/${encodeURIComponent(componentSetId)}`);
}

export async function putComponentSet(componentSetId: string, componentSet: ApiComponentSet) {
  return request<ApiComponentSet>(`/component-sets/${encodeURIComponent(componentSetId)}`, {
    method: "PUT",
    body: componentSet,
  });
}

export async function listReleases(componentId?: string) {
  const query = componentId ? `?componentId=${encodeURIComponent(componentId)}` : "";
  return request<ApiRelease[]>(`/releases${query}`);
}

export async function getRelease(componentId: string, version: string) {
  return request<ApiRelease>(`/releases/${encodeURIComponent(componentId)}/${encodeURIComponent(version)}`);
}

export async function createRelease(release: ApiRelease) {
  return request<ApiRelease>("/releases", {
    method: "POST",
    body: release,
  });
}

export async function listDeploysets() {
  return request<ApiDeploySet[]>("/deploysets");
}

export async function getDeployset(deploySetId: string) {
  return request<ApiDeploySet>(`/deploysets/${encodeURIComponent(deploySetId)}`);
}

export async function createDeployset(payload: ApiDeploySetCreateRequest) {
  return request<ApiDeploySetCreateResult>("/deploysets", {
    method: "POST",
    body: payload,
  });
}

export async function listEnvironments() {
  return request<ApiEnvironment[]>("/environments");
}

export async function putEnvironment(environmentId: string, environment: ApiEnvironment) {
  return request<ApiEnvironment>(`/environments/${encodeURIComponent(environmentId)}`, {
    method: "PUT",
    body: environment,
  });
}

export async function listEnvironmentState() {
  return request<ApiEnvironmentState[]>("/environment-state");
}

export async function listDeploymentExecutions(environmentId?: string) {
  const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : "";
  return request<ApiDeploymentExecution[]>(`/deployment-executions${query}`);
}

export async function getDeploymentExecution(deploymentExecutionId: string) {
  return request<ApiDeploymentExecution>(`/deployment-executions/${encodeURIComponent(deploymentExecutionId)}`);
}

export async function planDeployment(payload: ApiPlanDeploymentRequest) {
  return request<ApiDeploymentPlan>("/deployments/plan", {
    method: "POST",
    body: payload,
  });
}

export async function createDeployment(payload: ApiCreateDeploymentRequest) {
  return request<ApiCreateDeploymentResponse>("/deployments", {
    method: "POST",
    body: payload,
  });
}

export async function listPendingExecutions() {
  return request<ApiDeploymentExecution[]>("/adapter/executions/pending");
}

export async function claimExecution(deploymentExecutionId: string, claimedBy: string) {
  const payload: ApiClaimExecutionRequest = { claimedBy };
  return request<ApiDeploymentExecution>(`/adapter/executions/${encodeURIComponent(deploymentExecutionId)}/claim`, {
    method: "POST",
    body: payload,
  });
}

export async function reportExecutionStatus(deploymentExecutionId: string, status: ApiReportExecutionStatusRequest["status"]) {
  const payload: ApiReportExecutionStatusRequest = { status };
  return request<ApiDeploymentExecution>(`/adapter/executions/${encodeURIComponent(deploymentExecutionId)}/status`, {
    method: "POST",
    body: payload,
  });
}

export async function reportExecutionItemStatus(
  deploymentExecutionId: string,
  componentId: string,
  payload: ApiReportExecutionItemStatusRequest,
) {
  return request<ApiDeploymentExecution>(
    `/adapter/executions/${encodeURIComponent(deploymentExecutionId)}/items/${encodeURIComponent(componentId)}/status`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function fetchDashboardData(environmentId: string) {
  const executions = await listDeploymentExecutions(environmentId);
  return { executions };
}

export async function fetchEnvironmentCenterData() {
  const [environments, environmentState, deploysets, componentSets, executions, pendingExecutions] = await Promise.all([
    listEnvironments(),
    listEnvironmentState(),
    listDeploysets(),
    listComponentSets(),
    listDeploymentExecutions(),
    listPendingExecutions(),
  ]);

  return {
    environments,
    environmentState,
    deploysets,
    componentSets,
    executions,
    pendingExecutions,
  };
}

export type {
  ApiComponent,
  ApiComponentSet,
  ApiCreateDeploymentResponse,
  ApiDeploySet,
  ApiDeploySetCreateRequest,
  ApiDeploySetCreateResult,
  ApiDeploymentExecution,
  ApiDeploymentExecutionItem,
  ApiDeploymentPlan,
  ApiEnvironment,
  ApiEnvironmentState,
  ApiRelease,
} from "@/lib/api-types";
