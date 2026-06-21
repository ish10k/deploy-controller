import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { ApiWhoAmI } from "@/lib/api-types";

let mockUser: ApiWhoAmI | null = {
  principalId: "user:ops",
  type: "user",
  authMethod: "oidc",
  displayName: "Ops User",
  email: "ops@example.local",
  roles: ["admin"],
  permissions: ["principals:read"],
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/workspaces/default/deployments" } }),
  useNavigate: () => vi.fn(),
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

vi.mock("@/lib/app-context", () => ({
  useAppContext: () => ({
    workspace: { workspaceId: "default", organizationId: "default", displayName: "Default workspace", roles: ["admin"] },
    workspaceId: "default",
    workspaces: [{ workspaceId: "default", organizationId: "default", displayName: "Default workspace", roles: ["admin"] }],
    setWorkspaceId: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe("AppShell", () => {
  beforeEach(() => {
    mockUser = {
      principalId: "user:ops",
      type: "user",
      authMethod: "oidc",
      displayName: "Ops User",
      email: "ops@example.local",
      roles: ["admin"],
      permissions: ["principals:read", "roles:read", "webhooks:read", "tag_definitions:read"],
    };
  });

  it("shows users navigation when the principal can view users", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/workspaces/default/users");
    expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("href", "/workspaces/default/audit");
    expect(screen.getByRole("link", { name: "Publishers" })).toHaveAttribute("href", "/workspaces/default/publishers");
    expect(screen.getByRole("link", { name: "Webhooks" })).toHaveAttribute("href", "/workspaces/default/webhooks");
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute("href", "/workspaces/default/tags");
    expect(screen.getByRole("link", { name: "Deployments" })).toHaveAttribute("href", "/workspaces/default/deployments");
    expect(screen.getByRole("link", { name: "Registry" })).toHaveAttribute("href", "/workspaces/default/registry");
    expect(screen.getByRole("link", { name: /Change workspace/ })).toHaveAttribute("href", "/workspaces/select");
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Components" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ReleaseSets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ReleaseSets" })).not.toBeInTheDocument();
  });

  it("hides users navigation without user view permission", () => {
    mockUser = {
      ...mockUser!,
      permissions: ["deployments:read"],
    };

    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deployments" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tags" })).not.toBeInTheDocument();
  });
});
