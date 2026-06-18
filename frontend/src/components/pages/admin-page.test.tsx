import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { AdminPage } from "@/components/pages/admin-page";
import { ADMIN_PERMISSIONS, ADMIN_ROLES } from "@/lib/admin-capabilities";
import type {
  ApiBootstrapState,
  ApiComponent,
  ApiComponentSet,
  ApiDeploySet,
  ApiDeploymentExecution,
  ApiDeploymentRunner,
  ApiEnvironment,
  ApiPrincipal,
  ApiRelease,
  ApiReleaseSource,
  ApiWhoAmI,
} from "@/lib/api-types";

let mockUser: ApiWhoAmI = {
  principalId: "user:admin",
  type: "user",
  authMethod: "oidc",
  displayName: "Admin User",
  email: "admin@example.local",
  roles: [ADMIN_ROLES.platformAdmin],
  permissions: Object.values(ADMIN_PERMISSIONS),
};

const snapshot = buildSnapshot();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    isLoading: false,
    error: null,
    data: snapshot,
    refetch: vi.fn(),
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: mockUser,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => vi.fn(),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    mockUser = {
      principalId: "user:admin",
      type: "user",
      authMethod: "oidc",
      displayName: "Admin User",
      email: "admin@example.local",
      roles: [ADMIN_ROLES.platformAdmin],
      permissions: Object.values(ADMIN_PERMISSIONS),
    };
  });

  it("shows full management actions for platform admins", () => {
    render(<AdminPage />);

    expect(screen.getByRole("button", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Runner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Release source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Environment" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Rotate token" })).toHaveLength(2);
  });

  it("keeps viewer users in read-only mode", () => {
    mockUser = {
      principalId: "user:viewer",
      type: "user",
      authMethod: "oidc",
      displayName: "Viewer User",
      email: "viewer@example.local",
      roles: [ADMIN_ROLES.platformViewer],
      permissions: [ADMIN_PERMISSIONS.componentsRead, ADMIN_PERMISSIONS.componentSetsRead, ADMIN_PERMISSIONS.releasesRead, ADMIN_PERMISSIONS.deploysetsRead, ADMIN_PERMISSIONS.environmentsRead, ADMIN_PERMISSIONS.deploymentsRead],
    };

    render(<AdminPage />);

    expect(screen.queryByRole("button", { name: "Principal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Runner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release source" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Environment" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open components" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open deployments" })).toBeInTheDocument();
  });

  it("shows release-source scoped actions without admin controls", () => {
    mockUser = {
      principalId: "service:release-source:platform-ci",
      type: "service",
      authMethod: "pat",
      displayName: "Platform CI",
      email: null,
      roles: [ADMIN_ROLES.releaseSource],
      permissions: [ADMIN_PERMISSIONS.releaseSourcesWrite, ADMIN_PERMISSIONS.releaseSourcesPublish, ADMIN_PERMISSIONS.releasesCreate],
    };

    render(<AdminPage />);

    expect(screen.getByRole("button", { name: "Release source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rotate token" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Principal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Runner" })).not.toBeInTheDocument();
  });
});

function buildSnapshot(): {
  bootstrap: ApiBootstrapState;
  principals: ApiPrincipal[];
  deploymentRunners: ApiDeploymentRunner[];
  releaseSources: ApiReleaseSource[];
  environments: ApiEnvironment[];
  components: ApiComponent[];
  componentSets: ApiComponentSet[];
  deploysets: ApiDeploySet[];
  releases: ApiRelease[];
  deploymentExecutions: ApiDeploymentExecution[];
} {
  return {
    bootstrap: {
      completed: true,
      completedAt: "2026-06-01T10:00:00Z",
      completedBy: "user:admin",
    },
    principals: [
      {
        principalId: "user:admin",
        type: "user",
        displayName: "Admin User",
        email: "admin@example.local",
        authMethod: "oidc",
        externalIssuer: "http://issuer",
        externalSubject: "abc",
        active: true,
        roles: [ADMIN_ROLES.platformAdmin],
        tags: { team: "platform" },
        createdAt: "2026-06-01T09:00:00Z",
        createdBy: "system:first-login-bootstrap",
        updatedAt: null,
        lastSeenAt: "2026-06-17T10:00:00Z",
      },
    ],
    deploymentRunners: [
      {
        runnerId: "runner-1",
        displayName: "Runner 1",
        principalId: "service:deployment-runner:runner-1",
        authMethod: "pat",
        tokenHash: null,
        tokenPrefix: "settle",
        tokenCreatedAt: "2026-06-01T10:10:00Z",
        tokenRotatedAt: null,
        lastUsedAt: "2026-06-17T09:00:00Z",
        active: true,
        scope: { environmentIds: ["prod"], componentSetIds: ["platform"] },
        webhookId: null,
        lastHeartbeatAt: "2026-06-17T09:55:00Z",
        tags: { team: "platform" },
        createdAt: "2026-06-01T10:10:00Z",
        createdBy: "system",
      },
    ],
    releaseSources: [
      {
        releaseSourceId: "platform-ci",
        displayName: "Platform CI",
        principalId: "service:release-source:platform-ci",
        authMethod: "pat",
        tokenHash: null,
        tokenPrefix: "settle",
        tokenCreatedAt: "2026-06-01T10:20:00Z",
        tokenRotatedAt: null,
        lastUsedAt: "2026-06-17T09:20:00Z",
        active: true,
        scope: { componentIds: ["web"], componentSetIds: ["platform"] },
        tags: { team: "platform" },
        createdAt: "2026-06-01T10:20:00Z",
        createdBy: "system",
      },
    ],
    environments: [
      {
        environmentId: "prod",
        active: true,
        tags: { kind: "production" },
      },
    ],
    components: [
      {
        componentId: "web",
        type: "service",
        active: true,
        tags: { team: "platform" },
      },
    ],
    componentSets: [
      {
        componentSetId: "platform",
        description: "Platform stack",
        components: [{ componentId: "web" }],
        tags: { team: "platform" },
        createdAt: "2026-06-01T09:30:00Z",
        createdBy: "system",
      },
    ],
    deploysets: [
      {
        deploySetId: "prod-default",
        componentSetId: "platform",
        schemaVersion: 1,
        description: "Production baseline",
        notes: null,
        baseEnvironmentId: null,
        baseDeploySetId: null,
        items: [{ componentId: "web", version: "1.0.0", source: "explicit" }],
        createdAt: "2026-06-01T10:30:00Z",
        createdBy: "system",
        tags: { ring: "prod" },
      },
    ],
    releases: [
      {
        componentId: "web",
        version: "1.0.0",
        description: "Web release",
        notes: null,
        artifact: { key: "s3://artifact", digest: "sha256:abc" },
        source: null,
        createdAt: "2026-06-01T10:40:00Z",
        createdBy: "system",
        tags: { team: "platform" },
      },
    ],
    deploymentExecutions: [
      {
        deploymentExecutionId: "exec-1",
        environmentId: "prod",
        deploySetId: "prod-default",
        status: "succeeded",
        requestedBy: "user:admin",
        notes: null,
        force: false,
        startedAt: "2026-06-01T11:00:00Z",
        completedAt: "2026-06-01T11:05:00Z",
        claimedBy: "runner-1",
        items: [],
        tags: {},
      },
    ],
  };
}
