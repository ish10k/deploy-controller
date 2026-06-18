import type { ApiWhoAmI } from "@/lib/api-types";

export const ADMIN_ROLES = {
  platformAdmin: "platform-admin",
  platformDeployer: "platform-deployer",
  platformViewer: "platform-viewer",
  deploymentRunner: "deployment-runner",
  releaseSource: "release-source",
} as const;

export const ADMIN_PERMISSIONS = {
  componentsRead: "components:read",
  componentsWrite: "components:write",
  componentSetsRead: "component_sets:read",
  componentSetsWrite: "component_sets:write",
  releasesRead: "releases:read",
  releasesCreate: "releases:create",
  deploysetsRead: "deploysets:read",
  deploysetsCreate: "deploysets:create",
  environmentsRead: "environments:read",
  environmentsWrite: "environments:write",
  deploymentsRead: "deployments:read",
  deploymentsCreate: "deployments:create",
  deploymentsCancel: "deployments:cancel",
  executionsClaim: "executions:claim",
  executionsReportStatus: "executions:report_status",
  deploymentRunnersWrite: "deployment_runners:write",
  releaseSourcesWrite: "release_sources:write",
  releaseSourcesPublish: "release_sources:publish",
  principalsRead: "principals:read",
  principalsWrite: "principals:write",
  webhooksRead: "webhooks:read",
  webhooksWrite: "webhooks:write",
  webhookDeliveriesRead: "webhook_deliveries:read",
  webhookDeliveriesRetry: "webhook_deliveries:retry",
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export type AdminCapabilities = {
  isPlatformAdmin: boolean;
  canReadPrincipals: boolean;
  canWritePrincipals: boolean;
  canWriteComponents: boolean;
  canWriteComponentSets: boolean;
  canCreateReleases: boolean;
  canWriteDeploysets: boolean;
  canWriteEnvironments: boolean;
  canCreateDeployments: boolean;
  canCancelDeployments: boolean;
  canWriteDeploymentRunners: boolean;
  canRotateDeploymentRunnerTokens: boolean;
  canWriteReleaseSources: boolean;
  canRotateReleaseSourceTokens: boolean;
  canClaimExecutions: boolean;
  canReportExecutionStatus: boolean;
  canReadWebhooks: boolean;
  canWriteWebhooks: boolean;
  canRetryWebhookDeliveries: boolean;
};

function hasAnyPermission(permissions: readonly string[], required: readonly AdminPermission[]) {
  return required.some((permission) => permissions.includes(permission));
}

export function buildAdminCapabilities(user: ApiWhoAmI | null | undefined): AdminCapabilities {
  const permissions = user?.permissions ?? [];
  const isPlatformAdmin = Boolean(user?.roles.includes(ADMIN_ROLES.platformAdmin));
  const hasFullAccess = isPlatformAdmin;

  return {
    isPlatformAdmin,
    canReadPrincipals: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.principalsRead, ADMIN_PERMISSIONS.principalsWrite]),
    canWritePrincipals: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.principalsWrite]),
    canWriteComponents: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.componentsWrite]),
    canWriteComponentSets: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.componentSetsWrite]),
    canCreateReleases: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.releasesCreate]),
    canWriteDeploysets: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.deploysetsCreate]),
    canWriteEnvironments: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.environmentsWrite]),
    canCreateDeployments: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.deploymentsCreate]),
    canCancelDeployments: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.deploymentsCancel]),
    canWriteDeploymentRunners: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.deploymentRunnersWrite]),
    canRotateDeploymentRunnerTokens: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.deploymentRunnersWrite]),
    canWriteReleaseSources: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.releaseSourcesWrite]),
    canRotateReleaseSourceTokens: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.releaseSourcesWrite]),
    canClaimExecutions: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.executionsClaim]),
    canReportExecutionStatus: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.executionsReportStatus]),
    canReadWebhooks: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.webhooksRead, ADMIN_PERMISSIONS.webhooksWrite]),
    canWriteWebhooks: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.webhooksWrite]),
    canRetryWebhookDeliveries: hasFullAccess || hasAnyPermission(permissions, [ADMIN_PERMISSIONS.webhookDeliveriesRetry]),
  };
}
