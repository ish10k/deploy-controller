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
    select({ location: { pathname: "/deployments" } }),
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
      permissions: ["principals:read", "roles:read", "webhooks:read"],
    };
  });

  it("shows users navigation when the principal can view users", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Auth" })).toHaveAttribute("href", "/auth");
    expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("href", "/audit");
    expect(screen.getByRole("link", { name: "Release Sources" })).toHaveAttribute("href", "/release-sources");
    expect(screen.getByRole("link", { name: "Webhooks" })).toHaveAttribute("href", "/webhooks");
    expect(screen.getByRole("link", { name: "Deployments" })).toHaveAttribute("href", "/deployments");
    expect(screen.getByRole("link", { name: "Registry" })).toHaveAttribute("href", "/registry");
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Components" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Component Sets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "DeploySets" })).not.toBeInTheDocument();
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

    expect(screen.queryByRole("link", { name: "Auth" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deployments" })).toBeInTheDocument();
  });
});
