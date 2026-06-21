import { describe, expect, it } from "vitest";

import { router } from "@/routes/root";

describe("router", () => {
  it("registers workspace-scoped app routes", () => {
    const routesByPath = (router as unknown as { routesByPath?: Record<string, unknown> }).routesByPath;

    expect(routesByPath?.["/registry"]).not.toBeDefined();
    expect(routesByPath?.["/users"]).not.toBeDefined();
    expect(routesByPath?.["/deployments"]).not.toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/deployments"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/registry"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/users"]).toBeDefined();
    expect(routesByPath?.["/workspaces/select"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/release-sets"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/components"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/release-sets"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/releases"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/users"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/users/$principalId"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/roles"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/roles/$roleId"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/tags"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/audit"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/publishers"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/publishers/$publisherId"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/webhooks"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/webhooks/$webhookId"]).toBeDefined();
    expect(routesByPath?.["/workspaces/$workspaceId/webhook-deliveries/$deliveryId"]).toBeDefined();
  });
});
