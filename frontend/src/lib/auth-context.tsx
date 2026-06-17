import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiRequestError, whoami, type ApiWhoAmI } from "@/lib/api-client";
import { clearTokens, getAccessToken, rememberAccessTokenClaims } from "@/lib/auth-token";
import { logout, startLogin } from "@/lib/oidc-client";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "forbidden";
type AuthRefreshResult = {
  status: AuthStatus;
  error: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: ApiWhoAmI | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthRefreshResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiWhoAmI | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<AuthRefreshResult> => {
    const token = getAccessToken();
    if (!token) {
      setStatus("anonymous");
      setUser(null);
      setError(null);
      return { status: "anonymous", error: null };
    }
    setStatus("loading");
    rememberAccessTokenClaims(token);
    try {
      const nextUser = await whoami();
      setUser(nextUser);
      setStatus("authenticated");
      setError(null);
      return { status: "authenticated", error: null };
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 403) {
        setStatus("forbidden");
        setUser(null);
        setError(caught.message);
        return { status: "forbidden", error: caught.message };
      }
      if (caught instanceof ApiRequestError && caught.status === 401) {
        clearTokens();
        setStatus("anonymous");
        setUser(null);
        setError(caught.message);
        return { status: "anonymous", error: caught.message };
      }
      const message = caught instanceof Error ? caught.message : "Unable to authenticate.";
      setStatus("forbidden");
      setUser(null);
      setError(message);
      return { status: "forbidden", error: message };
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      login: () => startLogin(),
      logout,
      refresh,
    }),
    [error, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
