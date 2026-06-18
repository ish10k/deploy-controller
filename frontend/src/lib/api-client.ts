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
  ApiDeploymentRunner,
  ApiDeploymentRunnerCreateRequest,
  ApiDeploymentRunnerCreateResult,
  ApiDeploymentPlan,
  ApiEnvironment,
  ApiEnvironmentState,
  ApiEventLogEntry,
  ApiEventLogListResult,
  ApiPlanDeploymentRequest,
  ApiBootstrapState,
  ApiPrincipal,
  ApiRelease,
  ApiReleaseSource,
  ApiReleaseSourceCreateRequest,
  ApiReleaseSourceCreateResult,
  ApiReportExecutionItemStatusRequest,
  ApiReportExecutionStatusRequest,
  ApiRole,
  ApiRotateTokenResult,
  ApiWhoAmI,
  ApiWebhook,
  ApiWebhookDelivery,
  ApiWebhookFilter,
  ApiWebhookSubscription,
} from "@/lib/api-types";
import { getAccessToken } from "@/lib/auth-token";

const API_BASE = "/api";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiRequestError(payload?.detail ?? `Request failed with status ${response.status}`, response.status);
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
  principals: ["principals"] as const,
  roles: ["roles"] as const,
  role: (roleId: string) => ["roles", roleId] as const,
  releaseSources: ["release-sources"] as const,
  releaseSource: (releaseSourceId: string) => ["release-sources", releaseSourceId] as const,
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
  deploymentRunners: ["deployment-runners"] as const,
  pendingExecutions: ["runner-pending-executions"] as const,
  events: (filters?: EventLogFilters) => ["events", filters ?? {}] as const,
  event: (eventId: string) => ["events", eventId] as const,
  webhooks: ["webhooks"] as const,
  webhook: (webhookId: string) => ["webhooks", webhookId] as const,
  webhookDeliveries: (filters?: WebhookDeliveryFilters) => ["webhook-deliveries", filters ?? {}] as const,
  webhookDelivery: (deliveryId: string) => ["webhook-deliveries", deliveryId] as const,
} as const;

export type EventLogFilters = {
  limit?: number;
  cursor?: string | null;
  actorPrincipalId?: string;
  resourceType?: string;
  resourceId?: string;
  category?: string;
  action?: string;
  origin?: string;
  from?: string;
  to?: string;
};

export type WebhookDeliveryFilters = {
  webhookId?: string;
  eventId?: string;
  status?: string;
  resourceType?: string;
  resourceId?: string;
};

function queryString(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

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

export async function listReleaseSources() {
  return request<ApiReleaseSource[]>("/release-sources");
}

export async function getReleaseSource(releaseSourceId: string) {
  return request<ApiReleaseSource>(`/release-sources/${encodeURIComponent(releaseSourceId)}`);
}

export async function createReleaseSource(payload: ApiReleaseSourceCreateRequest) {
  return request<ApiReleaseSourceCreateResult>("/release-sources", {
    method: "POST",
    body: payload,
  });
}

export async function rotateReleaseSourceToken(releaseSourceId: string) {
  return request<ApiRotateTokenResult>(`/release-sources/${encodeURIComponent(releaseSourceId)}/rotate-token`, {
    method: "POST",
  });
}

export async function putReleaseSource(releaseSourceId: string, releaseSource: ApiReleaseSource) {
  return request<ApiReleaseSource>(`/release-sources/${encodeURIComponent(releaseSourceId)}`, {
    method: "PUT",
    body: releaseSource,
  });
}

export async function publishReleaseFromSource(releaseSourceId: string, release: ApiRelease) {
  return request<ApiRelease>(`/release-sources/${encodeURIComponent(releaseSourceId)}/releases`, {
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

export async function cancelDeploymentExecution(deploymentExecutionId: string) {
  return request<ApiDeploymentExecution>(`/deployment-executions/${encodeURIComponent(deploymentExecutionId)}/cancel`, {
    method: "POST",
  });
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

export async function listDeploymentRunners() {
  return request<ApiDeploymentRunner[]>("/deployment-runners");
}

export async function whoami() {
  return request<ApiWhoAmI>("/whoami");
}

export async function getBootstrapState() {
  return request<ApiBootstrapState>("/bootstrap");
}

export async function listPrincipals() {
  return request<ApiPrincipal[]>("/principals");
}

export async function listRoles() {
  return request<ApiRole[]>("/roles");
}

export async function getRole(roleId: string) {
  return request<ApiRole>(`/roles/${encodeURIComponent(roleId)}`);
}

export async function putRole(roleId: string, role: ApiRole) {
  return request<ApiRole>(`/roles/${encodeURIComponent(roleId)}`, {
    method: "PUT",
    body: role,
  });
}

export async function listEvents(filters: EventLogFilters = {}) {
  return request<ApiEventLogListResult>(`/events${queryString(filters)}`);
}

export async function getEvent(eventId: string) {
  return request<ApiEventLogEntry>(`/events/${encodeURIComponent(eventId)}`);
}

export async function listWebhooks() {
  return request<ApiWebhook[]>("/webhooks");
}

export async function getWebhook(webhookId: string) {
  return request<ApiWebhook>(`/webhooks/${encodeURIComponent(webhookId)}`);
}

export async function putWebhook(webhookId: string, webhook: ApiWebhook) {
  return request<ApiWebhook>(`/webhooks/${encodeURIComponent(webhookId)}`, {
    method: "PUT",
    body: webhook,
  });
}

export async function createWebhook(webhook: ApiWebhook) {
  return request<ApiWebhook>("/webhooks", {
    method: "POST",
    body: webhook,
  });
}

export async function listWebhookDeliveries(filters: WebhookDeliveryFilters = {}) {
  return request<ApiWebhookDelivery[]>(`/webhook-deliveries${queryString(filters)}`);
}

export async function getWebhookDelivery(deliveryId: string) {
  return request<ApiWebhookDelivery>(`/webhook-deliveries/${encodeURIComponent(deliveryId)}`);
}

export async function retryWebhookDelivery(deliveryId: string) {
  return request<ApiWebhookDelivery>(`/webhook-deliveries/${encodeURIComponent(deliveryId)}/retry`, {
    method: "POST",
  });
}

export async function getPrincipal(principalId: string) {
  return request<ApiPrincipal>(`/principals/${encodeURIComponent(principalId)}`);
}

export async function createPrincipal(principal: ApiPrincipal) {
  return request<ApiPrincipal>("/principals", {
    method: "POST",
    body: principal,
  });
}

export async function putPrincipal(principalId: string, principal: ApiPrincipal) {
  return request<ApiPrincipal>(`/principals/${encodeURIComponent(principalId)}`, {
    method: "PUT",
    body: principal,
  });
}

export async function getDeploymentRunner(runnerId: string) {
  return request<ApiDeploymentRunner>(`/deployment-runners/${encodeURIComponent(runnerId)}`);
}

export async function createDeploymentRunner(runner: ApiDeploymentRunnerCreateRequest) {
  return request<ApiDeploymentRunnerCreateResult>("/deployment-runners", {
    method: "POST",
    body: runner,
  });
}

export async function putDeploymentRunner(runnerId: string, runner: ApiDeploymentRunner) {
  return request<ApiDeploymentRunner>(`/deployment-runners/${encodeURIComponent(runnerId)}`, {
    method: "PUT",
    body: runner,
  });
}

export async function rotateDeploymentRunnerToken(runnerId: string) {
  return request<ApiRotateTokenResult>(`/deployment-runners/${encodeURIComponent(runnerId)}/rotate-token`, {
    method: "POST",
  });
}

export async function listPendingRunnerExecutions(runnerId: string) {
  return request<ApiDeploymentExecution[]>(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/pending`);
}

export async function listPendingExecutions() {
  const runners = await listDeploymentRunners();
  const grouped = await Promise.all(runners.map((runner) => listPendingRunnerExecutions(runner.runnerId)));
  const byId = new Map<string, ApiDeploymentExecution>();
  for (const execution of grouped.flat()) {
    byId.set(execution.deploymentExecutionId, execution);
  }
  return [...byId.values()];
}

export async function claimExecution(runnerId: string, deploymentExecutionId: string, leaseSeconds = 900) {
  const payload: ApiClaimExecutionRequest = { leaseSeconds };
  return request<ApiDeploymentExecution>(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/${encodeURIComponent(deploymentExecutionId)}/claim`, {
    method: "POST",
    body: payload,
  });
}

export async function reportExecutionStatus(runnerId: string, deploymentExecutionId: string, status: ApiReportExecutionStatusRequest["status"]) {
  const payload: ApiReportExecutionStatusRequest = { status };
  return request<ApiDeploymentExecution>(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/${encodeURIComponent(deploymentExecutionId)}/status`, {
    method: "POST",
    body: payload,
  });
}

export async function reportExecutionItemStatus(
  runnerId: string,
  deploymentExecutionId: string,
  componentId: string,
  payload: ApiReportExecutionItemStatusRequest,
) {
  return request<ApiDeploymentExecution>(
    `/deployment-runners/${encodeURIComponent(runnerId)}/executions/${encodeURIComponent(deploymentExecutionId)}/items/${encodeURIComponent(componentId)}/status`,
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
  ApiDeploymentRunner,
  ApiDeploymentRunnerCreateRequest,
  ApiDeploymentRunnerCreateResult,
  ApiDeploymentPlan,
  ApiEnvironment,
  ApiEnvironmentState,
  ApiEventLogEntry,
  ApiEventLogListResult,
  ApiBootstrapState,
  ApiPrincipal,
  ApiRelease,
  ApiReleaseSource,
  ApiReleaseSourceCreateRequest,
  ApiReleaseSourceCreateResult,
  ApiRole,
  ApiRotateTokenResult,
  ApiWhoAmI,
  ApiWebhook,
  ApiWebhookDelivery,
  ApiWebhookFilter,
  ApiWebhookSubscription,
} from "@/lib/api-types";
