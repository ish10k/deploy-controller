import { describe, expect, it } from "vitest";

import type { ApiWhoAmI } from "@/lib/api-types";
import { canChangeUserPermissions, canCreateUsers, canViewUsers } from "@/lib/user-permissions";

function userWithPermissions(permissions: string[]): ApiWhoAmI {
  return {
    principalId: "user:test",
    type: "user",
    authMethod: "oidc",
    displayName: "Test User",
    email: "test@example.com",
    roles: [],
    permissions,
  };
}

describe("user permission gates", () => {
  it("shows users to principals with principal read permission", () => {
    expect(canViewUsers(userWithPermissions(["principals:read"]))).toBe(true);
    expect(canCreateUsers(userWithPermissions(["principals:read"]))).toBe(false);
    expect(canChangeUserPermissions(userWithPermissions(["principals:read"]))).toBe(false);
  });

  it("enables user creation and permission changes with principal write permission", () => {
    const user = userWithPermissions(["principals:write"]);

    expect(canViewUsers(user)).toBe(true);
    expect(canCreateUsers(user)).toBe(true);
    expect(canChangeUserPermissions(user)).toBe(true);
  });

  it("denies user management without principal permissions", () => {
    const user = userWithPermissions(["deployments:read"]);

    expect(canViewUsers(user)).toBe(false);
    expect(canCreateUsers(user)).toBe(false);
    expect(canChangeUserPermissions(user)).toBe(false);
  });
});
