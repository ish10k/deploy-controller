import { createRootRoute, createRoute, createRouter, Outlet, useNavigate } from "@tanstack/react-router";

import { DeploymentDetailsPage } from "@/components/deployments/deployment-execution-details-page";
import { AuthCallbackPage, ForbiddenPage, LoginPage } from "@/components/auth/auth-pages";
import { DeploymentsPage } from "@/components/deployments/deployments-page";
import { EnvironmentsPage } from "@/components/environments/environments-page";
import { AppShell } from "@/components/layout/app-shell";
import { UnsupportedPage } from "@/components/common/api-state";
import { DeploymentRunnerDetailsPage, DeploymentRunnersPage } from "@/components/pages/adapters-page";
import { AuthPage } from "@/components/pages/auth-page";
import { ComponentDetailsPage } from "@/components/pages/component-details-page";
import { ReleaseSetDetailsPage } from "@/components/pages/deployset-details-page";
import { ExecutionsPage } from "@/components/pages/executions-page";
import { EventLogPage } from "@/components/pages/event-log-page";
import { ReleaseDetailsPage } from "@/components/pages/release-details-page";
import { PublisherDetailsPage, PublishersPage } from "@/components/pages/publishers-page";
import { RegistryPage } from "@/components/pages/registry-page";
import { RoleDetailsPage } from "@/components/pages/roles-page";
import { TagsPage } from "@/components/pages/tags-page";
import { UserDetailsPage } from "@/components/pages/users-page";
import { WebhookDeliveryDetailsPage, WebhookDetailsPage, WebhooksPage } from "@/components/pages/webhooks-page";
import { WorkspaceSelectorPage } from "@/components/pages/workspace-selector-page";
import { ModalProvider } from "@/components/ui/modal";
import { workspaceAppPath } from "@/lib/workspace-routes";

const rootRoute = createRootRoute({
  component: () => (
    <ModalProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ModalProvider>
  ),
});

const workspaceHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId",
  component: DeploymentsPage,
});
const workspaceDeploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/deployments",
  component: DeploymentsPage,
});

const workspaceDeploymentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/deployments/$deploymentId",
  component: () => {
    const { deploymentId } = workspaceDeploymentDetailRoute.useParams();
    return <DeploymentDetailsPage deploymentId={deploymentId} />;
  },
});

const workspacePlanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/deployments/plan",
  component: () => {
    const navigate = useNavigate();
    const { workspaceId } = workspacePlanRoute.useParams();
    return <DeploymentsPage initialPlanOpen onPlanClose={() => navigate({ to: workspaceAppPath(workspaceId, "/deployments") })} />;
  },
});

const workspaceRegistryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/registry", component: RegistryPage });
const workspaceUsersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/users", component: AuthPage });
const workspaceComponentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/components",
  component: () => <RegistryPage initialView="components" />,
});
const workspaceComponentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/components/$componentId",
  component: () => {
    const { componentId } = workspaceComponentDetailRoute.useParams();
    return <ComponentDetailsPage componentId={componentId} />;
  },
});

const authCallbackRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth/callback", component: AuthCallbackPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const forbiddenRoute = createRoute({ getParentRoute: () => rootRoute, path: "/forbidden", component: ForbiddenPage });
const workspaceSelectorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/select", component: WorkspaceSelectorPage });
const workspaceReleaseSetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/release-sets",
  component: () => <RegistryPage initialView="release-sets" />,
});
const workspaceReleaseSetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/release-sets/$releaseSetId",
  component: () => {
    const { releaseSetId } = workspaceReleaseSetDetailRoute.useParams();
    return <ReleaseSetDetailsPage releaseSetId={releaseSetId} />;
  },
});
const workspaceReleasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/releases",
  component: () => <RegistryPage initialView="releases" />,
});
const workspacePublishersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/publishers", component: PublishersPage });
const workspacePublisherDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/publishers/$publisherId",
  component: () => {
    const { publisherId } = workspacePublisherDetailRoute.useParams();
    return <PublisherDetailsPage publisherId={publisherId} />;
  },
});
const workspaceReleaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/releases/$componentId/$version",
  component: () => {
    const { componentId, version } = workspaceReleaseDetailRoute.useParams();
    return <ReleaseDetailsPage componentId={componentId} version={version} />;
  },
});
const workspaceEnvironmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/environments", component: EnvironmentsPage });
const workspaceRolesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/roles", component: () => <AuthPage initialView="roles" /> });
const workspaceRoleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/roles/$roleId",
  component: () => {
    const { roleId } = workspaceRoleDetailRoute.useParams();
    return <RoleDetailsPage roleId={roleId} />;
  },
});
const workspaceTagsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/tags", component: TagsPage });
const workspaceAuditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/audit", component: EventLogPage });
const workspaceWebhooksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/webhooks", component: WebhooksPage });
const workspaceWebhookDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/webhooks/$webhookId",
  component: () => {
    const { webhookId } = workspaceWebhookDetailRoute.useParams();
    return <WebhookDetailsPage webhookId={webhookId} />;
  },
});
const workspaceWebhookDeliveryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/webhook-deliveries/$deliveryId",
  component: () => {
    const { deliveryId } = workspaceWebhookDeliveryDetailRoute.useParams();
    return <WebhookDeliveryDetailsPage deliveryId={deliveryId} />;
  },
});
const workspaceUserDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/users/$principalId",
  component: () => {
    const { principalId } = workspaceUserDetailRoute.useParams();
    return <UserDetailsPage principalId={principalId} />;
  },
});
const workspaceEnvironmentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/environments/$environmentId",
  component: () => {
    const { environmentId } = workspaceEnvironmentDetailRoute.useParams();
    return <EnvironmentsPage routeEnvironmentId={environmentId} />;
  },
});
const workspaceExecutionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/executions",
  component: ExecutionsPage,
});
const workspaceDeploymentRunnersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/workspaces/$workspaceId/deployment-runners", component: DeploymentRunnersPage });
const workspaceDeploymentRunnerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/deployment-runners/$runnerId",
  component: () => {
    const { runnerId } = workspaceDeploymentRunnerDetailRoute.useParams();
    return <DeploymentRunnerDetailsPage runnerId={runnerId} />;
  },
});

const workspaceUnsupportedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId/unsupported/$feature",
  component: () => <UnsupportedPage title="Not exposed by current API" />,
});

export const routeTree = rootRoute.addChildren([
  authCallbackRoute,
  loginRoute,
  forbiddenRoute,
  workspaceSelectorRoute,
  workspaceHomeRoute,
  workspaceRegistryRoute,
  workspaceUsersRoute,
  workspaceRolesRoute,
  workspaceRoleDetailRoute,
  workspaceTagsRoute,
  workspaceAuditRoute,
  workspaceWebhooksRoute,
  workspaceWebhookDetailRoute,
  workspaceWebhookDeliveryDetailRoute,
  workspaceUserDetailRoute,
  workspaceDeploymentsRoute,
  workspaceDeploymentDetailRoute,
  workspacePlanRoute,
  workspaceComponentsRoute,
  workspaceComponentDetailRoute,
  workspaceReleaseSetsRoute,
  workspaceReleaseSetDetailRoute,
  workspaceReleasesRoute,
  workspacePublishersRoute,
  workspacePublisherDetailRoute,
  workspaceReleaseDetailRoute,
  workspaceEnvironmentsRoute,
  workspaceEnvironmentDetailRoute,
  workspaceExecutionsRoute,
  workspaceDeploymentRunnersRoute,
  workspaceDeploymentRunnerDetailRoute,
  workspaceUnsupportedRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}


