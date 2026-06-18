import { describe, expect, it } from "vitest";

import { router } from "@/routes/root";

describe("router", () => {
  it("registers the users routes", () => {
    const routesByPath = (router as unknown as { routesByPath?: Record<string, unknown> }).routesByPath;

    expect(routesByPath?.["/users"]).toBeDefined();
    expect(routesByPath?.["/users/$principalId"]).toBeDefined();
  });
});
