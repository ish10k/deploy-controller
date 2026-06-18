import type { ApiWhoAmI } from "@/lib/api-types";

export const USER_PERMISSIONS = {
  viewUsers: "principals:read",
  createUsers: "principals:write",
  changeUserPermissions: "principals:write",
} as const;

export function canViewUsers(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.viewUsers) || hasPermission(user, USER_PERMISSIONS.createUsers);
}

export function canCreateUsers(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.createUsers);
}

export function canChangeUserPermissions(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.changeUserPermissions);
}

function hasPermission(user: ApiWhoAmI | null | undefined, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}
