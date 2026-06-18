export type ExecutionStatus = "pending" | "claimed" | "running" | "succeeded" | "failed" | "cancelled";
export type ItemStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";
export type ReportedAction = "deploy" | "noop" | "skip";
export type RequestedAction = "deploy" | "skip";
export type RequestedReason =
  | "missing_latest_execution_item"
  | "latest_status_not_succeeded"
  | "version_changed"
  | "force"
  | "latest_execution_already_succeeded";
export type DriftReason =
  | "same_version_redeployed"
  | "same_version_target_missing"
  | "same_version_artifact_mismatch";
export type DeploySetItemSource = "explicit" | "inferred";
export type EnvironmentStatus = "idle" | "pending" | "claimed" | "running" | "succeeded" | "failed" | "cancelled";
export type PrincipalType = "user" | "service";
export type EventOrigin = "user" | "service" | "system";
export type EventSeverity = "info" | "warning" | "error";
export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed";
export type ApiPermission = string;

export interface Artifact {
  key: string;
  digest: string;
}

export interface Source {
  key: string;
  digest: string;
}

export interface ApiOrganization {
  organizationId: string;
  displayName: string;
  active: boolean;
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface ApiWorkspace {
  workspaceId: string;
  organizationId: string;
  displayName: string;
  active: boolean;
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface ApiOrganizationMembership {
  organizationId: string;
  principalId: string;
  roles: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface ApiWorkspaceMembership {
  workspaceId: string;
  principalId: string;
  roles: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface ApiComponent {
  workspaceId?: string;
  componentId: string;
  type: string | null;
  active: boolean;
  tags: Record<string, string>;
}

export interface ApiComponentSetItem {
  componentId: string;
}

export interface ApiComponentSet {
  workspaceId?: string;
  componentSetId: string;
  description: string | null;
  components: ApiComponentSetItem[];
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

export interface ApiRelease {
  workspaceId?: string;
  componentId: string;
  version: string;
  description: string | null;
  notes: string | null;
  artifact: Artifact;
  source: Source | null;
  createdAt: string;
  createdBy: string;
  tags: Record<string, string>;
}

export interface ApiReleaseSourceScope {
  componentSetIds: string[];
  componentIds: string[];
}

export interface ApiReleaseSource {
  workspaceId?: string;
  releaseSourceId: string;
  displayName: string;
  principalId: string;
  authMethod: string;
  tokenHash: string | null;
  tokenPrefix: string | null;
  tokenCreatedAt: string | null;
  tokenRotatedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
  scope: ApiReleaseSourceScope;
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

export interface ApiReleaseSourceCreateRequest {
  releaseSourceId: string;
  displayName: string;
  active: boolean;
  scope: ApiReleaseSourceScope;
  tags: Record<string, string>;
}

export interface ApiReleaseSourceCreateResult {
  releaseSource: ApiReleaseSource;
  token: string;
}

export interface ApiDeploySetItem {
  componentId: string;
  version: string;
  source: DeploySetItemSource;
}

export interface ApiDeploySet {
  workspaceId?: string;
  deploySetId: string;
  componentSetId: string;
  schemaVersion: number;
  description: string | null;
  notes: string | null;
  baseEnvironmentId: string | null;
  baseDeploySetId: string | null;
  items: ApiDeploySetItem[];
  createdAt: string;
  createdBy: string;
  tags: Record<string, string>;
}

export interface ApiDeploySetCreateItem {
  componentId: string;
  version: string;
}

export interface ApiDeploySetCreateRequest {
  deploySetId: string;
  componentSetId: string;
  baseEnvironmentId: string | null;
  baseDeploySetId: string | null;
  notes: string | null;
  items: ApiDeploySetCreateItem[];
  createdBy: string;
  tags: Record<string, string>;
}

export interface ApiDeploySetCreateResult {
  deployset: ApiDeploySet;
  warnings: string[];
}

export interface ApiEnvironment {
  workspaceId?: string;
  environmentId: string;
  active: boolean;
  tags: Record<string, string>;
}

export interface ApiDeploymentRunnerScope {
  environmentIds: string[];
  componentSetIds: string[];
}

export interface ApiDeploymentRunner {
  workspaceId?: string;
  runnerId: string;
  displayName: string;
  principalId: string;
  authMethod: string;
  tokenHash: string | null;
  tokenPrefix: string | null;
  tokenCreatedAt: string | null;
  tokenRotatedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
  scope: ApiDeploymentRunnerScope;
  webhookId: string | null;
  lastHeartbeatAt: string | null;
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

export interface ApiDeploymentRunnerCreateRequest {
  runnerId: string;
  displayName: string;
  active: boolean;
  scope: ApiDeploymentRunnerScope;
  webhookId: string | null;
  tags: Record<string, string>;
}

export interface ApiDeploymentRunnerCreateResult {
  runner: ApiDeploymentRunner;
  token: string;
}

export interface ApiRotateTokenResult {
  token: string;
}

export interface ApiPrincipal {
  principalId: string;
  type: PrincipalType;
  displayName: string;
  email: string | null;
  authMethod: "oidc" | "pat" | string;
  externalIssuer: string | null;
  externalSubject: string | null;
  active: boolean;
  roles: string[];
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  lastSeenAt: string | null;
}

export interface ApiBootstrapState {
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}

export interface ApiWhoAmI {
  principalId: string;
  type: PrincipalType;
  authMethod: "oidc" | "pat" | string;
  displayName: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  organizations?: Array<{ organizationId: string; displayName: string; roles: string[] }>;
  workspaces?: Array<{ workspaceId: string; organizationId: string; displayName: string; roles: string[] }>;
}

export interface ApiRole {
  workspaceId?: string;
  roleId: string;
  permissions: ApiPermission[];
  description: string | null;
  system: boolean;
  permissionsEditable: boolean;
}

export interface ApiEventResourceRef {
  resourceType: string;
  resourceId: string;
}

export interface ApiEventChange {
  field: string;
  before: unknown | null;
  after: unknown | null;
}

export interface ApiEventLogEntry {
  workspaceId?: string;
  eventId: string;
  occurredAt: string;
  actorPrincipalId: string;
  actorType: string;
  origin: EventOrigin;
  action: string;
  category: string;
  severity: EventSeverity;
  summary: string;
  resourceType: string;
  resourceId: string;
  relatedResources: ApiEventResourceRef[];
  correlationId: string | null;
  requestId: string | null;
  changes: ApiEventChange[];
  metadata: Record<string, unknown>;
}

export interface ApiEventLogListResult {
  events: ApiEventLogEntry[];
  nextCursor: string | null;
}

export interface ApiWebhookRetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
}

export interface ApiWebhookFilter {
  resourceTypes: string[];
  resourceIds: string[];
  categories: string[];
  origins: string[];
  severities: string[];
}

export interface ApiWebhookSubscription {
  subscriptionId: string;
  eventTypes: string[];
  filters: ApiWebhookFilter;
}

export interface ApiWebhook {
  workspaceId?: string;
  webhookId: string;
  displayName: string;
  url: string;
  active: boolean;
  retryPolicy: ApiWebhookRetryPolicy;
  subscriptions: ApiWebhookSubscription[];
  secretRef: string | null;
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
}

export interface ApiWebhookEnvelope {
  schemaVersion: "webhook.v1";
  workspaceId?: string;
  deliveryId: string;
  webhookId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  sentAt: string | null;
  attempt: number;
  actor: { principalId: string; type: string; origin: string };
  resource: { type: string; id: string };
  relatedResources: ApiEventResourceRef[];
  data: Record<string, unknown>;
  changes: ApiEventChange[];
  metadata: Record<string, unknown>;
}

export interface ApiWebhookDelivery {
  workspaceId?: string;
  webhookDeliveryId: string;
  webhookId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  envelope: ApiWebhookEnvelope;
  attempts: number;
  nextAttemptAt: string | null;
  lastResponseStatus: number | null;
  lastResponseBody: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiEnvironmentState {
  workspaceId?: string;
  environmentId: string;
  deploySetId: string | null;
  status: EnvironmentStatus;
  lastDeploymentExecutionId: string | null;
  updatedAt: string;
}

export interface ApiDeploymentExecutionItem {
  componentId: string;
  version: string;
  artifact: Artifact;
  requestedAction: RequestedAction;
  reportedAction: ReportedAction | null;
  status: ItemStatus;
  requestedReason: RequestedReason | null;
  runnerReason: string | null;
  driftDetected: boolean;
  driftReason: DriftReason | null;
  reportedBy: string | null;
  message: string | null;
  error: string | null;
}

export interface ApiDeploymentExecution {
  workspaceId?: string;
  deploymentExecutionId: string;
  environmentId: string;
  deploySetId: string;
  status: ExecutionStatus;
  requestedBy: string;
  notes: string | null;
  force: boolean;
  startedAt: string;
  completedAt: string | null;
  claimedBy: string | null;
  items: ApiDeploymentExecutionItem[];
  tags: Record<string, string>;
}

export interface ApiDeploymentPlan {
  workspaceId?: string;
  environmentId: string;
  deploySetId: string;
  items: ApiDeploymentExecutionItem[];
}

export interface ApiCreateDeploymentRequest {
  environmentId: string;
  deploySetId: string;
  requestedBy: string;
  notes: string | null;
  force: boolean;
  tags: Record<string, string>;
}

export interface ApiCreateDeploymentResponse {
  deploymentExecutionId: string;
  status: ExecutionStatus;
}

export interface ApiPlanDeploymentRequest {
  environmentId: string;
  deploySetId: string;
  force: boolean;
}

export interface ApiClaimExecutionRequest {
  leaseSeconds: number | null;
}

export interface ApiReportExecutionStatusRequest {
  status: ExecutionStatus;
}

export interface ApiReportExecutionItemStatusRequest {
  status: ItemStatus;
  reportedAction: ReportedAction;
  reportedBy: string | null;
  runnerReason: string | null;
  message: string | null;
  error: string | null;
}

export type components = {
  schemas: {
    Artifact: Artifact;
    Component: ApiComponent;
    ComponentSet: ApiComponentSet;
    DeploySet: ApiDeploySet;
    DeploymentExecution: ApiDeploymentExecution;
    DeploymentExecutionItem: ApiDeploymentExecutionItem;
    DeploymentRunner: ApiDeploymentRunner;
    DeploymentRunnerCreateRequest: ApiDeploymentRunnerCreateRequest;
    DeploymentRunnerCreateResult: ApiDeploymentRunnerCreateResult;
    Environment: ApiEnvironment;
    EnvironmentState: ApiEnvironmentState;
    EventLogEntry: ApiEventLogEntry;
    EventLogListResult: ApiEventLogListResult;
    ExecutionStatus: ExecutionStatus;
    ItemStatus: ItemStatus;
    Release: ApiRelease;
    ReleaseSource: ApiReleaseSource;
    ReleaseSourceCreateRequest: ApiReleaseSourceCreateRequest;
    ReleaseSourceCreateResult: ApiReleaseSourceCreateResult;
    RotateTokenResult: ApiRotateTokenResult;
    Principal: ApiPrincipal;
    Role: ApiRole;
    BootstrapState: ApiBootstrapState;
    WhoAmI: ApiWhoAmI;
    ReportExecutionItemStatusRequest: ApiReportExecutionItemStatusRequest;
    ReportedAction: ReportedAction;
  };
};
