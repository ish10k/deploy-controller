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
  required: boolean;
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
  artifact: Artifact;
  source: Source | null;
  createdAt: string;
  createdBy: string;
  tags: Record<string, string>;
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
  adapterReason: string | null;
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
  force: boolean;
  startedAt: string;
  completedAt: string | null;
  claimedBy: string | null;
  items: ApiDeploymentExecutionItem[];
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
  force: boolean;
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
  claimedBy: string;
}

export interface ApiReportExecutionStatusRequest {
  status: ExecutionStatus;
}

export interface ApiReportExecutionItemStatusRequest {
  status: ItemStatus;
  reportedAction: ReportedAction;
  reportedBy: string;
  adapterReason: string | null;
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
    Environment: ApiEnvironment;
    EnvironmentState: ApiEnvironmentState;
    ExecutionStatus: ExecutionStatus;
    ItemStatus: ItemStatus;
    Release: ApiRelease;
    ReportExecutionItemStatusRequest: ApiReportExecutionItemStatusRequest;
    ReportedAction: ReportedAction;
  };
};
