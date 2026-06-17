import { clearTokens, storeTokens } from "@/lib/auth-token";

const OIDC_STATE_KEY = "settle.oidc.state";
const OIDC_VERIFIER_KEY = "settle.oidc.codeVerifier";

const issuer = import.meta.env.VITE_OIDC_ISSUER ?? "http://localhost:5556/realms/settle";
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? "settle-ui";
const redirectPath = "/auth/callback";

function redirectUri() {
  return `${window.location.origin}${redirectPath}`;
}

function randomString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes));
}

async function discovery() {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error("Unable to load OIDC configuration.");
  }
  return (await response.json()) as {
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint?: string;
  };
}

export async function startLogin(returnTo = window.location.pathname + window.location.search) {
  const config = await discovery();
  const state = randomString();
  const verifier = randomString(64);
  const challenge = base64Url(await sha256(verifier));
  window.sessionStorage.setItem(OIDC_STATE_KEY, JSON.stringify({ state, returnTo }));
  window.sessionStorage.setItem(OIDC_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${config.authorization_endpoint}?${params}`);
}

export async function completeLogin(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = JSON.parse(window.sessionStorage.getItem(OIDC_STATE_KEY) || "null") as { state: string; returnTo: string } | null;
  const verifier = window.sessionStorage.getItem(OIDC_VERIFIER_KEY);
  window.sessionStorage.removeItem(OIDC_STATE_KEY);
  window.sessionStorage.removeItem(OIDC_VERIFIER_KEY);

  if (!code || !state || !storedState || !verifier || state !== storedState.state) {
    throw new Error("OIDC login response could not be verified.");
  }

  const config = await discovery();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("OIDC token exchange failed.");
  }
  const payload = (await response.json()) as {
    access_token: string;
    id_token?: string;
    expires_in: number;
  };
  storeTokens({
    accessToken: payload.access_token,
    idToken: payload.id_token ?? null,
    expiresAt: Date.now() + payload.expires_in * 1000,
  });
  return storedState.returnTo || "/";
}

export async function logout() {
  const tokens = await import("@/lib/auth-token").then((module) => module.getStoredTokens());
  clearTokens();
  const config = await discovery().catch(() => null);
  if (config?.end_session_endpoint) {
    const params = new URLSearchParams({
      client_id: clientId,
      post_logout_redirect_uri: window.location.origin,
    });
    if (tokens?.idToken) {
      params.set("id_token_hint", tokens.idToken);
    }
    window.location.assign(`${config.end_session_endpoint}?${params}`);
    return;
  }
  window.location.assign("/");
}
