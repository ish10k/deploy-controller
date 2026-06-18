import { describe, expect, it } from "vitest";

import { router } from "@/routes/root";

describe("router", () => {
  it("registers the admin route", () => {
    expect((router as unknown as { routesByPath?: Record<string, unknown> }).routesByPath?.["/admin"]).toBeDefined();
  });
});

