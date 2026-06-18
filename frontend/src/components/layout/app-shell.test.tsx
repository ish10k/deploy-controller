import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { ApiWhoAmI } from "@/lib/api-types";

let mockUser: ApiWhoAmI | null = {
  principalId: "user:admin",
  type: "user",
  authMethod: "oidc",
  displayName: "Admin User",
  email: "admin@example.local",
  roles: ["platform-admin"],
  permissions: ["principals:read"],
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouterState: () => ({ location: { pathname: "/deployments" } }),
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

describe("AppShell", () => {
  beforeEach(() => {
    mockUser = {
      principalId: "user:admin",
      type: "user",
      authMethod: "oidc",
      displayName: "Admin User",
      email: "admin@example.local",
      roles: ["platform-admin"],
      permissions: ["principals:read"],
    };
  });

  it("shows the admin route in governance navigation", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deployments" })).toBeInTheDocument();
  });
});
