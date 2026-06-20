import type {
  ApiComponent,
  ApiComponentSet,
  ApiCreateDeploymentRequest,
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
  ApiOrganization,
  ApiOrganizationMembership,
  ApiPlanDeploymentRequest,
  ApiBootstrapState,
  ApiPrincipal,
  ApiRelease,
  ApiPublisher,
  ApiPublisherCreateRequest,
  ApiPublisherCreateResult,
  ApiReportExecutionItemStatusRequest,
  ApiRole,
  ApiRotateTokenResult,
  ApiWhoAmI,
  ApiWebhook,
  ApiWebhookDelivery,
  ApiWebhookFilter,
  ApiWebhookSubscription,
  ApiWorkspace,
  ApiWorkspaceMembership,
} from "@/lib/api-types";
import { getAccessToken } from "@/lib/auth-token";

const API_BASE = "/api";
let activeWorkspaceId: string | null = null;

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

type AuthFailureHandler = (error: ApiRequestError) => void;

let authFailureHandler: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

export function setActiveWorkspaceId(workspaceId: string | null) {
  activeWorkspaceId = workspaceId;
}

function workspacePath(path: string) {
  if (!activeWorkspaceId) {
    throw new ApiRequestError("No active workspace is selected.", 400);
  }
  return `/workspaces/${encodeURIComponent(activeWorkspaceId)}${path}`;
}

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
    const error = new ApiRequestError(payload?.detail ?? `Request failed with status ${response.status}`, response.status);
    if (response.status === 401) {
      authFailureHandler?.(error);
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const queryKeys = {
  organizations: ["organizations"] as const,
  organization: (organizationId: string) => ["organizations", organizationId] as const,
  organizationWorkspaces: (organizationId: string) => ["organizations", organizationId, "workspaces"] as const,
  workspace: (workspaceId: string) => ["workspaces", workspaceId] as const,
  workspaceMemberships: (workspaceId: string) => ["workspaces", workspaceId, "memberships"] as const,
  components: ["workspace", "components"] as const,
  componentSets: ["workspace", "component-sets"] as const,
  releases: (componentId?: string) => ["workspace", "releases", componentId ?? "all"] as const,
  principals: ["principals"] as const,
  roles: ["workspace", "roles"] as const,
  role: (roleId: string) => ["workspace", "roles", roleId] as const,
  publishers: ["workspace", "publishers"] as const,
  publisher: (publisherId: string) => ["workspace", "publishers", publisherId] as const,
  deploysets: ["workspace", "deploysets"] as const,
  deployset: (deploySetId: string) => ["workspace", "deploysets", deploySetId] as const,
  environments: ["workspace", "environments"] as const,
  environmentState: ["workspace", "environment-state"] as const,
  environmentCenter: ["workspace", "environment-center"] as const,
  executions: (environmentId?: string) => ["workspace", "deployment-executions", environmentId ?? "all"] as const,
  execution: (deploymentExecutionId: string) => ["workspace", "deployment-executions", deploymentExecutionId] as const,
  deploymentPlan: (environmentId: string, deploySetId: string, force: boolean) =>
    ["workspace", "deployment-plan", environmentId || "none", deploySetId || "none", force ? "force" : "normal"] as const,
  dashboard: (environmentId: string) => ["workspace", "dashboard", environmentId] as const,
  deploymentRunners: ["workspace", "deployment-runners"] as const,
  pendingExecutions: ["workspace", "runner-pending-executions"] as const,
  events: (filters?: EventLogFilters) => ["events", filters ?? {}] as const,
  event: (eventId: string) => ["events", eventId] as const,
  webhooks: ["workspace", "webhooks"] as const,
  webhook: (webhookId: string) => ["workspace", "webhooks", webhookId] as const,
  webhookDeliveries: (filters?: WebhookDeliveryFilters) => ["workspace", "webhook-deliveries", filters ?? {}] as const,
  webhookDelivery: (deliveryId: string) => ["workspace", "webhook-deliveries", deliveryId] as const,
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

export async function listOrganizations() {
  return request<ApiOrganization[]>("/organizations");
}

export async function getOrganization(organizationId: string) {
  return request<ApiOrganization>(`/organizations/${encodeURIComponent(organizationId)}`);
}

export async function putOrganization(organizationId: string, organization: ApiOrganization) {
  return request<ApiOrganization>(`/organizations/${encodeURIComponent(organizationId)}`, {
    method: "PUT",
    body: organization,
  });
}

export async function listOrganizationWorkspaces(organizationId: string) {
  return request<ApiWorkspace[]>(`/organizations/${encodeURIComponent(organizationId)}/workspaces`);
}

export async function createOrganizationWorkspace(organizationId: string, workspace: ApiWorkspace) {
  return request<ApiWorkspace>(`/organizations/${encodeURIComponent(organizationId)}/workspaces`, {
    method: "POST",
    body: workspace,
  });
}

export async function getWorkspace(workspaceId: string) {
  return request<ApiWorkspace>(`/workspaces/${encodeURIComponent(workspaceId)}`);
}

export async function putWorkspace(workspaceId: string, workspace: ApiWorkspace) {
  return request<ApiWorkspace>(`/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "PUT",
    body: workspace,
  });
}

export async function listWorkspaceMemberships(workspaceId: string) {
  return request<ApiWorkspaceMembership[]>(`/workspaces/${encodeURIComponent(workspaceId)}/memberships`);
}

export async function putWorkspaceMembership(workspaceId: string, principalId: string, membership: ApiWorkspaceMembership) {
  return request<ApiWorkspaceMembership>(`/workspaces/${encodeURIComponent(workspaceId)}/memberships/${encodeURIComponent(principalId)}`, {
    method: "PUT",
    body: membership,
  });
}

export async function listOrganizationMemberships(organizationId: string) {
  return request<ApiOrganizationMembership[]>(`/organizations/${encodeURIComponent(organizationId)}/memberships`);
}

export async function putOrganizationMembership(organizationId: string, principalId: string, membership: ApiOrganizationMembership) {
  return request<ApiOrganizationMembership>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(principalId)}`, {
    method: "PUT",
    body: membership,
  });
}

export async function listComponents() {
  return request<ApiComponent[]>(workspacePath("/components"));
}

export async function getComponent(componentId: string) {
  return request<ApiComponent>(workspacePath(`/components/${encodeURIComponent(componentId)}`));
}

export async function putComponent(componentId: string, component: ApiComponent) {
  return request<ApiComponent>(workspacePath(`/components/${encodeURIComponent(componentId)}`), {
    method: "PUT",
    body: component,
  });
}

export async function listComponentSets() {
  return request<ApiComponentSet[]>(workspacePath("/component-sets"));
}

export async function getComponentSet(componentSetId: string) {
  return request<ApiComponentSet>(workspacePath(`/component-sets/${encodeURIComponent(componentSetId)}`));
}

export async function putComponentSet(componentSetId: string, componentSet: ApiComponentSet) {
  return request<ApiComponentSet>(workspacePath(`/component-sets/${encodeURIComponent(componentSetId)}`), {
    method: "PUT",
    body: componentSet,
  });
}

export async function listReleases(componentId?: string) {
  const query = componentId ? `?componentId=${encodeURIComponent(componentId)}` : "";
  return request<ApiRelease[]>(workspacePath(`/releases${query}`));
}

export async function getRelease(componentId: string, version: string) {
  return request<ApiRelease>(workspacePath(`/releases/${encodeURIComponent(componentId)}/${encodeURIComponent(version)}`));
}

export async function createRelease(release: ApiRelease) {
  return request<ApiRelease>(workspacePath("/releases"), {
    method: "POST",
    body: release,
  });
}

export async function listPublishers() {
  return request<ApiPublisher[]>(workspacePath("/publishers"));
}

export async function getPublisher(publisherId: string) {
  return request<ApiPublisher>(workspacePath(`/publishers/${encodeURIComponent(publisherId)}`));
}

export async function createPublisher(payload: ApiPublisherCreateRequest) {
  return request<ApiPublisherCreateResult>(workspacePath("/publishers"), {
    method: "POST",
    body: payload,
  });
}

export async function rotatePublisherToken(publisherId: string) {
  return request<ApiRotateTokenResult>(workspacePath(`/publishers/${encodeURIComponent(publisherId)}/rotate-token`), {
    method: "POST",
  });
}

export async function putPublisher(publisherId: string, publisher: ApiPublisher) {
  return request<ApiPublisher>(workspacePath(`/publishers/${encodeURIComponent(publisherId)}`), {
    method: "PUT",
    body: publisher,
  });
}

export async function publishReleaseFromPublisher(publisherId: string, release: ApiRelease) {
  return request<ApiRelease>(workspacePath(`/publishers/${encodeURIComponent(publisherId)}/releases`), {
    method: "POST",
    body: release,
  });
}

export async function listDeploysets() {
  return request<ApiDeploySet[]>(workspacePath("/deploysets"));
}

export async function getDeployset(deploySetId: string) {
  return request<ApiDeploySet>(workspacePath(`/deploysets/${encodeURIComponent(deploySetId)}`));
}

export async function createDeployset(payload: ApiDeploySetCreateRequest) {
  return request<ApiDeploySetCreateResult>(workspacePath("/deploysets"), {
    method: "POST",
    body: payload,
  });
}

export async function listEnvironments() {
  return request<ApiEnvironment[]>(workspacePath("/environments"));
}

export async function putEnvironment(environmentId: string, environment: ApiEnvironment) {
  return request<ApiEnvironment>(workspacePath(`/environments/${encodeURIComponent(environmentId)}`), {
    method: "PUT",
    body: environment,
  });
}

export async function listEnvironmentState() {
  return request<ApiEnvironmentState[]>(workspacePath("/environment-state"));
}

export async function listDeploymentExecutions(environmentId?: string) {
  const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : "";
  return request<ApiDeploymentExecution[]>(workspacePath(`/deployment-executions${query}`));
}

export async function getDeploymentExecution(deploymentExecutionId: string) {
  return request<ApiDeploymentExecution>(workspacePath(`/deployment-executions/${encodeURIComponent(deploymentExecutionId)}`));
}

export async function cancelDeploymentExecution(deploymentExecutionId: string) {
  return request<ApiDeploymentExecution>(workspacePath(`/deployment-executions/${encodeURIComponent(deploymentExecutionId)}/cancel`), {
    method: "POST",
  });
}

export async function planDeployment(payload: ApiPlanDeploymentRequest) {
  return request<ApiDeploymentPlan>(workspacePath("/deployments/plan"), {
    method: "POST",
    body: payload,
  });
}

export async function createDeployment(payload: ApiCreateDeploymentRequest) {
  return request<ApiCreateDeploymentResponse>(workspacePath("/deployments"), {
    method: "POST",
    body: payload,
  });
}

export async function listDeploymentRunners() {
  return request<ApiDeploymentRunner[]>(workspacePath("/deployment-runners"));
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
  return request<ApiRole[]>(workspacePath("/roles"));
}

export async function getRole(roleId: string) {
  return request<ApiRole>(workspacePath(`/roles/${encodeURIComponent(roleId)}`));
}

export async function putRole(roleId: string, role: ApiRole) {
  return request<ApiRole>(workspacePath(`/roles/${encodeURIComponent(roleId)}`), {
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
  return request<ApiWebhook[]>(workspacePath("/webhooks"));
}

export async function getWebhook(webhookId: string) {
  return request<ApiWebhook>(workspacePath(`/webhooks/${encodeURIComponent(webhookId)}`));
}

export async function putWebhook(webhookId: string, webhook: ApiWebhook) {
  return request<ApiWebhook>(workspacePath(`/webhooks/${encodeURIComponent(webhookId)}`), {
    method: "PUT",
    body: webhook,
  });
}

export async function createWebhook(webhook: ApiWebhook) {
  return request<ApiWebhook>(workspacePath("/webhooks"), {
    method: "POST",
    body: webhook,
  });
}

export async function listWebhookDeliveries(filters: WebhookDeliveryFilters = {}) {
  return request<ApiWebhookDelivery[]>(workspacePath(`/webhook-deliveries${queryString(filters)}`));
}

export async function getWebhookDelivery(deliveryId: string) {
  return request<ApiWebhookDelivery>(workspacePath(`/webhook-deliveries/${encodeURIComponent(deliveryId)}`));
}

export async function retryWebhookDelivery(deliveryId: string) {
  return request<ApiWebhookDelivery>(workspacePath(`/webhook-deliveries/${encodeURIComponent(deliveryId)}/retry`), {
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
  return request<ApiDeploymentRunner>(workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}`));
}

export async function createDeploymentRunner(runner: ApiDeploymentRunnerCreateRequest) {
  return request<ApiDeploymentRunnerCreateResult>(workspacePath("/deployment-runners"), {
    method: "POST",
    body: runner,
  });
}

export async function putDeploymentRunner(runnerId: string, runner: ApiDeploymentRunner) {
  return request<ApiDeploymentRunner>(workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}`), {
    method: "PUT",
    body: runner,
  });
}

export async function rotateDeploymentRunnerToken(runnerId: string) {
  return request<ApiRotateTokenResult>(workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}/rotate-token`), {
    method: "POST",
  });
}

export async function listDeploymentRunnerItems(runnerId: string) {
  return request<ApiDeploymentExecutionItem[]>(workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/items`));
}

export async function listPendingRunnerExecutions(runnerId: string) {
  return request<ApiDeploymentExecutionItem[]>(workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/pending`));
}

export async function listPendingExecutions() {
  return request<ApiDeploymentExecution[]>(workspacePath("/deployment-executions/pending"));
}

export async function reportExecutionItemStatus(
  runnerId: string,
  deploymentExecutionId: string,
  componentId: string,
  payload: ApiReportExecutionItemStatusRequest,
) {
  return request<ApiDeploymentExecution>(
    workspacePath(`/deployment-runners/${encodeURIComponent(runnerId)}/executions/${encodeURIComponent(deploymentExecutionId)}/items/${encodeURIComponent(componentId)}/status`),
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
  ApiOrganization,
  ApiOrganizationMembership,
  ApiBootstrapState,
  ApiPrincipal,
  ApiRelease,
  ApiPublisher,
  ApiPublisherCreateRequest,
  ApiPublisherCreateResult,
  ApiRole,
  ApiRotateTokenResult,
  ApiWhoAmI,
  ApiWebhook,
  ApiWebhookDelivery,
  ApiWebhookFilter,
  ApiWebhookSubscription,
  ApiWorkspace,
  ApiWorkspaceMembership,
} from "@/lib/api-types";
