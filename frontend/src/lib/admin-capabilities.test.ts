import { describe, expect, it } from "vitest";

import { ADMIN_ROLES, ADMIN_PERMISSIONS, buildAdminCapabilities } from "@/lib/admin-capabilities";
import type { ApiWhoAmI } from "@/lib/api-types";

function makeUser(roles: string[], permissions: string[]): ApiWhoAmI {
  return {
    principalId: "user:admin",
    type: "user",
    authMethod: "oidc",
    displayName: "Admin User",
    email: "admin@example.local",
    roles,
    permissions,
  };
}

describe("buildAdminCapabilities", () => {
  it("grants full admin capabilities when the platform admin role is present", () => {
    const capabilities = buildAdminCapabilities(
      makeUser([ADMIN_ROLES.platformAdmin], Object.values(ADMIN_PERMISSIONS)),
    );

    expect(capabilities.isPlatformAdmin).toBe(true);
    expect(capabilities.canWritePrincipals).toBe(true);
    expect(capabilities.canWriteDeploymentRunners).toBe(true);
    expect(capabilities.canWriteReleaseSources).toBe(true);
    expect(capabilities.canWriteEnvironments).toBe(true);
    expect(capabilities.canCreateDeployments).toBe(true);
    expect(capabilities.canClaimExecutions).toBe(true);
  });

  it("keeps viewer users read-only", () => {
    const capabilities = buildAdminCapabilities(
      makeUser([ADMIN_ROLES.platformViewer], [ADMIN_PERMISSIONS.componentsRead, ADMIN_PERMISSIONS.deploysetsRead, ADMIN_PERMISSIONS.deploymentsRead]),
    );

    expect(capabilities.isPlatformAdmin).toBe(false);
    expect(capabilities.canWritePrincipals).toBe(false);
    expect(capabilities.canWriteDeploymentRunners).toBe(false);
    expect(capabilities.canWriteReleaseSources).toBe(false);
    expect(capabilities.canWriteEnvironments).toBe(false);
    expect(capabilities.canCreateDeployments).toBe(false);
  });

  it("surfaces release-source and runner-specific permissions", () => {
    const capabilities = buildAdminCapabilities(
      makeUser(
        [ADMIN_ROLES.releaseSource, ADMIN_ROLES.deploymentRunner],
        [ADMIN_PERMISSIONS.releaseSourcesWrite, ADMIN_PERMISSIONS.releaseSourcesPublish, ADMIN_PERMISSIONS.executionsClaim, ADMIN_PERMISSIONS.executionsReportStatus],
      ),
    );

    expect(capabilities.canWriteReleaseSources).toBe(true);
    expect(capabilities.canRotateReleaseSourceTokens).toBe(true);
    expect(capabilities.canClaimExecutions).toBe(true);
    expect(capabilities.canReportExecutionStatus).toBe(true);
    expect(capabilities.canWritePrincipals).toBe(false);
  });
});

