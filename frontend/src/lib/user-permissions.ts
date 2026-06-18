import type { ApiWhoAmI } from "@/lib/api-types";

export const USER_PERMISSIONS = {
  viewUsers: "principals:read",
  createUsers: "principals:write",
  changeUserPermissions: "principals:write",
  viewRoles: "roles:read",
  changeRoles: "roles:write",
  manageReleaseSources: "release_sources:write",
  viewWebhooks: "webhooks:read",
  manageWebhooks: "webhooks:write",
  viewWebhookDeliveries: "webhook_deliveries:read",
  retryWebhookDeliveries: "webhook_deliveries:retry",
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

export function canViewRoles(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.viewRoles) || hasPermission(user, USER_PERMISSIONS.changeRoles);
}

export function canChangeRoles(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.changeRoles);
}

export function canManageReleaseSources(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.manageReleaseSources);
}

export function canViewWebhooks(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.viewWebhooks) || hasPermission(user, USER_PERMISSIONS.manageWebhooks);
}

export function canManageWebhooks(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.manageWebhooks);
}

export function canViewWebhookDeliveries(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.viewWebhookDeliveries) || hasPermission(user, USER_PERMISSIONS.retryWebhookDeliveries);
}

export function canRetryWebhookDeliveries(user: ApiWhoAmI | null | undefined) {
  return hasPermission(user, USER_PERMISSIONS.retryWebhookDeliveries);
}

function hasPermission(user: ApiWhoAmI | null | undefined, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}
