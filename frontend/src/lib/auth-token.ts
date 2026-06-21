const ACCESS_TOKEN_KEY = "settle.auth.accessToken";
const ID_TOKEN_KEY = "settle.auth.idToken";
const EXPIRES_AT_KEY = "settle.auth.expiresAt";
const LAST_ACCESS_TOKEN_CLAIMS_KEY = "settle.auth.lastAccessTokenClaims";

export type StoredTokens = {
  accessToken: string;
  idToken: string | null;
  expiresAt: number;
};

export function getStoredTokens(): StoredTokens | null {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY));
  if (!accessToken || !expiresAt) {
    return null;
  }
  return {
    accessToken,
    idToken: window.localStorage.getItem(ID_TOKEN_KEY),
    expiresAt,
  };
}

export function getAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens || tokens.expiresAt <= Date.now() + 10_000) {
    return null;
  }
  return tokens.accessToken;
}

export function rememberAccessTokenClaims(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    window.sessionStorage.removeItem(LAST_ACCESS_TOKEN_CLAIMS_KEY);
    return;
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims = JSON.parse(atob(normalized)) as unknown;
    window.sessionStorage.setItem(LAST_ACCESS_TOKEN_CLAIMS_KEY, JSON.stringify(claims, null, 2));
  } catch {
    window.sessionStorage.removeItem(LAST_ACCESS_TOKEN_CLAIMS_KEY);
  }
}

export function storeTokens(tokens: StoredTokens) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.idToken) {
    window.localStorage.setItem(ID_TOKEN_KEY, tokens.idToken);
  } else {
    window.localStorage.removeItem(ID_TOKEN_KEY);
  }
  window.localStorage.setItem(EXPIRES_AT_KEY, String(tokens.expiresAt));
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ID_TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_AT_KEY);
}

