import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeploymentsPage } from "@/components/deployments/deployments-page";
import { AuthPage } from "@/components/pages/auth-page";
import { RegistryPage } from "@/components/pages/registry-page";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/pages/components-page", () => ({
  ComponentsPage: ({ createSignal }: { createSignal: number }) => <div>Components panel {createSignal}</div>,
}));

vi.mock("@/components/pages/component-sets-page", () => ({
  ComponentSetsPage: ({ createSignal }: { createSignal: number }) => <div>Component sets panel {createSignal}</div>,
}));

vi.mock("@/components/pages/releases-page", () => ({
  ReleasesPage: ({ createSignal }: { createSignal: number }) => <div>Releases panel {createSignal}</div>,
}));

vi.mock("@/components/pages/users-page", () => ({
  UsersPage: ({ createSignal }: { createSignal: number }) => <div>Users panel {createSignal}</div>,
}));

vi.mock("@/components/pages/roles-page", () => ({
  RolesPage: ({ createSignal }: { createSignal: number }) => <div>Roles panel {createSignal}</div>,
}));

vi.mock("@/components/pages/deploysets-page", () => ({
  DeploysetsPage: ({ createSignal }: { createSignal: number }) => <div>DeploySets panel {createSignal}</div>,
}));

vi.mock("@/components/pages/deployment-workflow-page", () => ({
  DeploymentWorkflowPage: () => <div>Deployment workflow</div>,
}));

vi.mock("@/lib/app-context", () => ({
  useAppContext: () => ({ environmentId: "prod" }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      principalId: "user:ops",
      displayName: "Ops",
      roles: ["admin"],
      permissions: ["principals:write", "roles:write"],
    },
  }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    listDeploymentExecutions: vi.fn(async () => []),
    fetchDashboardData: vi.fn(async () => ({ executions: [] })),
  };
});

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("consolidated pages", () => {
  it("switches registry views and opens create drawers from header actions", () => {
    render(<RegistryPage />);

    expect(screen.getByText("Releases panel 0")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Select registry view"), { target: { value: "components" } });
    expect(screen.getByText("Components panel 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    expect(screen.getByText("Releases panel 1")).toBeInTheDocument();
  });

  it("switches auth views and respects create action routing", () => {
    render(<AuthPage />);

    expect(screen.getByText("Users panel 0")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Select auth view"), { target: { value: "roles" } });
    expect(screen.getByText("Roles panel 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create role" }));
    expect(screen.getByText("Roles panel 1")).toBeInTheDocument();
  });

  it("switches deployments views and opens deployset creation from the header", async () => {
    renderWithQueryClient(<DeploymentsPage />);

    await waitFor(() => expect(screen.getByText("No executions match the current filters.")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Select deployment workspace view"), { target: { value: "deploysets" } });
    expect(screen.getByText("DeploySets panel 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create DeploySet" }));
    expect(screen.getByText("DeploySets panel 1")).toBeInTheDocument();
  });
});
