import { createRootRoute, createRoute, createRouter, Outlet, useNavigate } from "@tanstack/react-router";

import { DeploymentExecutionDetailsPage } from "@/components/deployments/deployment-execution-details-page";
import { AuthCallbackPage, ForbiddenPage, LoginPage } from "@/components/auth/auth-pages";
import { DeploymentsPage } from "@/components/deployments/deployments-page";
import { EnvironmentsPage } from "@/components/environments/environments-page";
import { AppShell } from "@/components/layout/app-shell";
import { UnsupportedPage } from "@/components/common/api-state";
import { DeploymentRunnerDetailsPage, DeploymentRunnersPage } from "@/components/pages/adapters-page";
import { ComponentDetailsPage } from "@/components/pages/component-details-page";
import { ComponentSetDetailsPage } from "@/components/pages/component-set-details-page";
import { ComponentSetsPage } from "@/components/pages/component-sets-page";
import { ComponentsPage } from "@/components/pages/components-page";
import { DeploySetDetailsPage } from "@/components/pages/deployset-details-page";
import { DeploysetsPage } from "@/components/pages/deploysets-page";
import { ExecutionsPage } from "@/components/pages/executions-page";
import { ReleaseDetailsPage } from "@/components/pages/release-details-page";
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
const componentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/components/$componentId",
  component: () => {
    const { componentId } = componentDetailRoute.useParams();
    return <ComponentDetailsPage componentId={componentId} />;
  },
});

const authCallbackRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth/callback", component: AuthCallbackPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const forbiddenRoute = createRoute({ getParentRoute: () => rootRoute, path: "/forbidden", component: ForbiddenPage });
const componentSetsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/component-sets", component: ComponentSetsPage });
const componentSetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/component-sets/$componentSetId",
  component: () => {
    const { componentSetId } = componentSetDetailRoute.useParams();
    return <ComponentSetDetailsPage componentSetId={componentSetId} />;
  },
});
const releasesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/releases", component: ReleasesPage });
const releaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/releases/$componentId/$version",
  component: () => {
    const { componentId, version } = releaseDetailRoute.useParams();
    return <ReleaseDetailsPage componentId={componentId} version={version} />;
  },
});
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
const deploymentRunnersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/deployment-runners", component: DeploymentRunnersPage });
const deploymentRunnerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployment-runners/$runnerId",
  component: () => {
    const { runnerId } = deploymentRunnerDetailRoute.useParams();
    return <DeploymentRunnerDetailsPage runnerId={runnerId} />;
  },
});

const unsupportedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unsupported/$feature",
  component: () => <UnsupportedPage title="Not exposed by current API" />,
});

export const routeTree = rootRoute.addChildren([
  authCallbackRoute,
  loginRoute,
  forbiddenRoute,
  indexRoute,
  deploymentsRoute,
  deploymentExecutionDetailRoute,
  planRoute,
  componentsRoute,
  componentDetailRoute,
  componentSetsRoute,
  componentSetDetailRoute,
  releasesRoute,
  releaseDetailRoute,
  deploysetsRoute,
  deploysetDetailRoute,
  environmentsRoute,
  environmentDetailRoute,
  executionsRoute,
  deploymentRunnersRoute,
  deploymentRunnerDetailRoute,
  unsupportedRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
