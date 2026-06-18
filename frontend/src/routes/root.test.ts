import { describe, expect, it } from "vitest";

import { router } from "@/routes/root";

describe("router", () => {
  it("registers the governance routes", () => {
    const routesByPath = (router as unknown as { routesByPath?: Record<string, unknown> }).routesByPath;

    expect(routesByPath?.["/registry"]).toBeDefined();
    expect(routesByPath?.["/auth"]).toBeDefined();
    expect(routesByPath?.["/deployments"]).toBeDefined();
    expect(routesByPath?.["/deploysets"]).toBeDefined();
    expect(routesByPath?.["/components"]).toBeDefined();
    expect(routesByPath?.["/component-sets"]).toBeDefined();
    expect(routesByPath?.["/releases"]).toBeDefined();
    expect(routesByPath?.["/users"]).toBeDefined();
    expect(routesByPath?.["/users/$principalId"]).toBeDefined();
    expect(routesByPath?.["/roles"]).toBeDefined();
    expect(routesByPath?.["/roles/$roleId"]).toBeDefined();
    expect(routesByPath?.["/audit"]).toBeDefined();
    expect(routesByPath?.["/release-sources"]).toBeDefined();
    expect(routesByPath?.["/release-sources/$releaseSourceId"]).toBeDefined();
    expect(routesByPath?.["/webhooks"]).toBeDefined();
    expect(routesByPath?.["/webhooks/$webhookId"]).toBeDefined();
    expect(routesByPath?.["/webhook-deliveries/$deliveryId"]).toBeDefined();
  });
});
