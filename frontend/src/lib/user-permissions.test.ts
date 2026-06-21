import { describe, expect, it } from "vitest";

import type { ApiWhoAmI } from "@/lib/api-types";
import { canCancelDeployments, canChangeUserPermissions, canCreateUsers, canViewUsers } from "@/lib/user-permissions";

function userWithPermissions(permissions: NonNullable<ApiWhoAmI["permissions"]>): ApiWhoAmI {
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
    expect(canViewUsers(userWithPermissions(["principals:read"] as NonNullable<ApiWhoAmI["permissions"]>))).toBe(true);
    expect(canCreateUsers(userWithPermissions(["principals:read"] as NonNullable<ApiWhoAmI["permissions"]>))).toBe(false);
    expect(canChangeUserPermissions(userWithPermissions(["principals:read"] as NonNullable<ApiWhoAmI["permissions"]>))).toBe(false);
    expect(canCancelDeployments(userWithPermissions(["principals:read"] as NonNullable<ApiWhoAmI["permissions"]>))).toBe(false);
  });

  it("enables user creation and permission changes with principal write permission", () => {
    const user = userWithPermissions(["principals:write"] as NonNullable<ApiWhoAmI["permissions"]>);

    expect(canViewUsers(user)).toBe(true);
    expect(canCreateUsers(user)).toBe(true);
    expect(canChangeUserPermissions(user)).toBe(true);
    expect(canCancelDeployments(user)).toBe(false);
  });

  it("denies user management without principal permissions", () => {
    const user = userWithPermissions(["deployments:read"] as NonNullable<ApiWhoAmI["permissions"]>);

    expect(canViewUsers(user)).toBe(false);
    expect(canCreateUsers(user)).toBe(false);
    expect(canChangeUserPermissions(user)).toBe(false);
    expect(canCancelDeployments(user)).toBe(false);
  });

  it("enables deployment cancellation with the cancel permission", () => {
    const user = userWithPermissions(["deployments:cancel"] as NonNullable<ApiWhoAmI["permissions"]>);

    expect(canCancelDeployments(user)).toBe(true);
  });
});

