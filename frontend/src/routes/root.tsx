import { createRootRoute, createRoute, createRouter, Outlet, useNavigate } from "@tanstack/react-router";

import { DeploymentExecutionDetailsPage } from "@/components/deployments/deployment-execution-details-page";
import { DeploymentsPage } from "@/components/deployments/deployments-page";
import { EnvironmentsPage } from "@/components/environments/environments-page";
import { AppShell } from "@/components/layout/app-shell";
import { UnsupportedPage } from "@/components/common/api-state";
import { AdaptersPage } from "@/components/pages/adapters-page";
import { ComponentSetsPage } from "@/components/pages/component-sets-page";
import { ComponentsPage } from "@/components/pages/components-page";
import { DeploySetDetailsPage } from "@/components/pages/deployset-details-page";
import { DeploysetsPage } from "@/components/pages/deploysets-page";
import { ExecutionsPage } from "@/components/pages/executions-page";
import { ReleasesPage } from "@/components/pages/releases-page";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DeploymentsPage,
});

const deploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments",
  component: DeploymentsPage,
});

const deploymentExecutionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments/$deploymentExecutionId",
  component: () => {
    const { deploymentExecutionId } = deploymentExecutionDetailRoute.useParams();
    return <DeploymentExecutionDetailsPage deploymentExecutionId={deploymentExecutionId} />;
  },
});

const planRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments/plan",
  component: () => {
    const navigate = useNavigate();
    return <DeploymentsPage initialPlanOpen onPlanClose={() => navigate({ to: "/deployments" })} />;
  },
});

const componentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/components", component: ComponentsPage });
const componentSetsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/component-sets", component: ComponentSetsPage });
const releasesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/releases", component: ReleasesPage });
const deploysetsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/deploysets", component: DeploysetsPage });
const deploysetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deploysets/$deploySetId",
  component: () => {
    const { deploySetId } = deploysetDetailRoute.useParams();
    return <DeploySetDetailsPage deploySetId={deploySetId} />;
  },
});
const environmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/environments", component: EnvironmentsPage });
const environmentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/environments/$environmentId",
  component: () => {
    const { environmentId } = environmentDetailRoute.useParams();
    return <EnvironmentsPage routeEnvironmentId={environmentId} />;
  },
});
const executionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/executions", component: ExecutionsPage });
const adaptersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/adapters", component: AdaptersPage });

const unsupportedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unsupported/$feature",
  component: () => <UnsupportedPage title="Not exposed by current API" />,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  deploymentsRoute,
  deploymentExecutionDetailRoute,
  planRoute,
  componentsRoute,
  componentSetsRoute,
  releasesRoute,
  deploysetsRoute,
  deploysetDetailRoute,
  environmentsRoute,
  environmentDetailRoute,
  executionsRoute,
  adaptersRoute,
  unsupportedRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
