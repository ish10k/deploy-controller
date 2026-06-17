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

export interface Artifact {
  key: string;
  digest: string;
}

export interface Source {
  key: string;
  digest: string;
}

export interface ApiComponent {
  componentId: string;
  type: string | null;
  active: boolean;
  tags: Record<string, string>;
}

export interface ApiComponentSetItem {
  componentId: string;
}

export interface ApiComponentSet {
  componentSetId: string;
  description: string | null;
  components: ApiComponentSetItem[];
  tags: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

export interface ApiRelease {
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
  environmentId: string;
  active: boolean;
  tags: Record<string, string>;
}

export interface ApiDeploymentRunnerScope {
  environmentIds: string[];
  componentSetIds: string[];
}

export interface ApiDeploymentRunner {
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
}

export interface ApiEnvironmentState {
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
    ExecutionStatus: ExecutionStatus;
    ItemStatus: ItemStatus;
    Release: ApiRelease;
    ReleaseSource: ApiReleaseSource;
    ReleaseSourceCreateRequest: ApiReleaseSourceCreateRequest;
    ReleaseSourceCreateResult: ApiReleaseSourceCreateResult;
    RotateTokenResult: ApiRotateTokenResult;
    Principal: ApiPrincipal;
    BootstrapState: ApiBootstrapState;
    WhoAmI: ApiWhoAmI;
    ReportExecutionItemStatusRequest: ApiReportExecutionItemStatusRequest;
    ReportedAction: ReportedAction;
  };
};
