export function workspaceAppPath(workspaceId: string, path = "/deployments") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/workspaces/${encodeURIComponent(workspaceId)}${normalizedPath}`;
}

export function workspaceRoutePath(path = "/deployments") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/workspaces/$workspaceId${normalizedPath}`;
}

export function workspaceIdFromPath(pathname: string) {
  const match = /^\/workspaces\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match || match[1] === "select") {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export function workspaceRelativePath(pathname: string) {
  const match = /^\/workspaces\/[^/]+(\/.*)?$/.exec(pathname);
  return match?.[1] || "/deployments";
}

