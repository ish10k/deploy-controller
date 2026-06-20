from enum import StrEnum


class EnvironmentStatus(StrEnum):
    IDLE = "idle"
    PENDING = "pending"
    CLAIMED = "claimed"
    RUNNING = "in-progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionStatus(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    RUNNING = "in-progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RequestedAction(StrEnum):
    DEPLOY = "deploy"
    SKIP = "skip"


class RequestedReason(StrEnum):
    MISSING_LATEST_EXECUTION_ITEM = "missing_latest_execution_item"
    LATEST_STATUS_NOT_SUCCEEDED = "latest_status_not_succeeded"
    VERSION_CHANGED = "version_changed"
    FORCE = "force"
    LATEST_EXECUTION_ALREADY_SUCCEEDED = "latest_execution_already_succeeded"


class ReportedAction(StrEnum):
    DEPLOY = "deploy"
    NOOP = "noop"
    SKIP = "skip"


class ItemStatus(StrEnum):
    PENDING = "pending"
    CLAIMED = "claimed"
    RUNNING = "in-progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class DeploySetItemSource(StrEnum):
    EXPLICIT = "explicit"
    INFERRED = "inferred"


class PrincipalType(StrEnum):
    USER = "user"
    SERVICE = "service"


class EventOrigin(StrEnum):
    USER = "user"
    SERVICE = "service"
    SYSTEM = "system"


class EventSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class TagResourceType(StrEnum):
    ORGANIZATION = "organization"
    WORKSPACE = "workspace"
    COMPONENT = "component"
    COMPONENT_SET = "component-set"
    RELEASE = "release"
    DEPLOYSET = "deployset"
    DEPLOYMENT_EXECUTION = "deployment-execution"
    ENVIRONMENT = "environment"
    DEPLOYMENT_RUNNER = "deployment-runner"
    PUBLISHER = "publisher"
    PRINCIPAL = "principal"
    WEBHOOK = "webhook"


class Permission(StrEnum):
    ORGANIZATIONS_READ = "organizations:read"
    ORGANIZATIONS_WRITE = "organizations:write"
    WORKSPACES_READ = "workspaces:read"
    WORKSPACES_WRITE = "workspaces:write"
    WORKSPACES_CREATE = "workspaces:create"
    ORGANIZATION_MEMBERSHIPS_READ = "organization_memberships:read"
    ORGANIZATION_MEMBERSHIPS_WRITE = "organization_memberships:write"
    WORKSPACE_MEMBERSHIPS_READ = "workspace_memberships:read"
    WORKSPACE_MEMBERSHIPS_WRITE = "workspace_memberships:write"
    COMPONENTS_READ = "components:read"
    COMPONENTS_WRITE = "components:write"
    COMPONENT_SETS_READ = "component_sets:read"
    COMPONENT_SETS_WRITE = "component_sets:write"
    RELEASES_READ = "releases:read"
    RELEASES_CREATE = "releases:create"
    DEPSETS_READ = "deploysets:read"
    DEPSETS_CREATE = "deploysets:create"
    ENVIRONMENTS_READ = "environments:read"
    ENVIRONMENTS_WRITE = "environments:write"
    DEPLOYMENTS_READ = "deployments:read"
    DEPLOYMENTS_CREATE = "deployments:create"
    DEPLOYMENTS_CANCEL = "deployments:cancel"
    EXECUTIONS_CLAIM = "executions:claim"
    EXECUTIONS_REPORT_STATUS = "executions:report_status"
    DEPLOYMENT_RUNNERS_WRITE = "deployment_runners:write"
    PUBLISHERS_WRITE = "publishers:write"
    PUBLISHERS_PUBLISH = "publishers:publish"
    PRINCIPALS_READ = "principals:read"
    PRINCIPALS_WRITE = "principals:write"
    ROLES_READ = "roles:read"
    ROLES_WRITE = "roles:write"
    WEBHOOKS_READ = "webhooks:read"
    WEBHOOKS_WRITE = "webhooks:write"
    WEBHOOK_DELIVERIES_READ = "webhook_deliveries:read"
    WEBHOOK_DELIVERIES_RETRY = "webhook_deliveries:retry"
    EVENTS_READ = "events:read"
    TAG_DEFINITIONS_READ = "tag_definitions:read"


class WebhookEvent(StrEnum):
    DEPLOYSET_CREATED = "deployset.created"
    DEPLOYMENT_CREATED = "deployment.created"
    DEPLOYMENT_STATUS_CHANGED = "deployment.status_changed"
    DEPLOYMENT_ITEM_STATUS_CHANGED = "deployment_item.status_changed"


class WebhookDeliveryStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


ITEM_STATUSES = frozenset(ItemStatus)
REPORTED_ACTIONS = frozenset(ReportedAction)
EXECUTION_STATUSES = frozenset(ExecutionStatus)


class DriftReason(StrEnum):
    SAME_VERSION_REDEPLOYED = "same_version_redeployed"
    SAME_VERSION_TARGET_MISSING = "same_version_target_missing"
    SAME_VERSION_ARTIFACT_MISMATCH = "same_version_artifact_mismatch"
