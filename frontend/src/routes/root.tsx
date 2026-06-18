import { createRootRoute, createRoute, createRouter, Outlet, useNavigate } from "@tanstack/react-router";

import { DeploymentExecutionDetailsPage } from "@/components/deployments/deployment-execution-details-page";
import { AuthCallbackPage, ForbiddenPage, LoginPage } from "@/components/auth/auth-pages";
import { DeploymentsPage } from "@/components/deployments/deployments-page";
import { EnvironmentsPage } from "@/components/environments/environments-page";
import { AppShell } from "@/components/layout/app-shell";
import { UnsupportedPage } from "@/components/common/api-state";
import { DeploymentRunnerDetailsPage, DeploymentRunnersPage } from "@/components/pages/adapters-page";
import { AuthPage } from "@/components/pages/auth-page";
import { ComponentDetailsPage } from "@/components/pages/component-details-page";
import { ComponentSetDetailsPage } from "@/components/pages/component-set-details-page";
import { DeploySetDetailsPage } from "@/components/pages/deployset-details-page";
import { EventLogPage } from "@/components/pages/event-log-page";
import { ReleaseDetailsPage } from "@/components/pages/release-details-page";
import { ReleaseSourceDetailsPage, ReleaseSourcesPage } from "@/components/pages/release-sources-page";
import { RegistryPage } from "@/components/pages/registry-page";
import { RoleDetailsPage } from "@/components/pages/roles-page";
import { UserDetailsPage } from "@/components/pages/users-page";
import { WebhookDeliveryDetailsPage, WebhookDetailsPage, WebhooksPage } from "@/components/pages/webhooks-page";
import { ModalProvider } from "@/components/ui/modal";

const rootRoute = createRootRoute({
  component: () => (
    <ModalProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ModalProvider>
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

const registryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/registry", component: RegistryPage });
const authRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth", component: AuthPage });
const componentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/components",
  component: () => <RegistryPage initialView="components" />,
});
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
const componentSetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/component-sets",
  component: () => <RegistryPage initialView="component-sets" />,
});
const componentSetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/component-sets/$componentSetId",
  component: () => {
    const { componentSetId } = componentSetDetailRoute.useParams();
    return <ComponentSetDetailsPage componentSetId={componentSetId} />;
  },
});
const releasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/releases",
  component: () => <RegistryPage initialView="releases" />,
});
const releaseSourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/release-sources", component: ReleaseSourcesPage });
const releaseSourceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/release-sources/$releaseSourceId",
  component: () => {
    const { releaseSourceId } = releaseSourceDetailRoute.useParams();
    return <ReleaseSourceDetailsPage releaseSourceId={releaseSourceId} />;
  },
});
const releaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/releases/$componentId/$version",
  component: () => {
    const { componentId, version } = releaseDetailRoute.useParams();
    return <ReleaseDetailsPage componentId={componentId} version={version} />;
  },
});
const deploysetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deploysets",
  component: () => <DeploymentsPage initialView="deploysets" />,
});
const deploysetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deploysets/$deploySetId",
  component: () => {
    const { deploySetId } = deploysetDetailRoute.useParams();
    return <DeploySetDetailsPage deploySetId={deploySetId} />;
  },
});
const environmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/environments", component: EnvironmentsPage });
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: () => <AuthPage initialView="users" /> });
const rolesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/roles", component: () => <AuthPage initialView="roles" /> });
const roleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roles/$roleId",
  component: () => {
    const { roleId } = roleDetailRoute.useParams();
    return <RoleDetailsPage roleId={roleId} />;
  },
});
const auditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/audit", component: EventLogPage });
const webhooksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/webhooks", component: WebhooksPage });
const webhookDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/webhooks/$webhookId",
  component: () => {
    const { webhookId } = webhookDetailRoute.useParams();
    return <WebhookDetailsPage webhookId={webhookId} />;
  },
});
const webhookDeliveryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/webhook-deliveries/$deliveryId",
  component: () => {
    const { deliveryId } = webhookDeliveryDetailRoute.useParams();
    return <WebhookDeliveryDetailsPage deliveryId={deliveryId} />;
  },
});
const userDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users/$principalId",
  component: () => {
    const { principalId } = userDetailRoute.useParams();
    return <UserDetailsPage principalId={principalId} />;
  },
});
const environmentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/environments/$environmentId",
  component: () => {
    const { environmentId } = environmentDetailRoute.useParams();
    return <EnvironmentsPage routeEnvironmentId={environmentId} />;
  },
});
const executionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/executions",
  component: () => <DeploymentsPage initialView="executions" />,
});
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
  registryRoute,
  authRoute,
  usersRoute,
  rolesRoute,
  roleDetailRoute,
  auditRoute,
  webhooksRoute,
  webhookDetailRoute,
  webhookDeliveryDetailRoute,
  userDetailRoute,
  deploymentsRoute,
  deploymentExecutionDetailRoute,
  planRoute,
  componentsRoute,
  componentDetailRoute,
  componentSetsRoute,
  componentSetDetailRoute,
  releasesRoute,
  releaseSourcesRoute,
  releaseSourceDetailRoute,
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
