import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ApiRequestError, setAuthFailureHandler, whoami, type ApiWhoAmI } from "@/lib/api-client";
import { clearTokens, getAccessToken, rememberAccessTokenClaims } from "@/lib/auth-token";
import { logout, startLogin } from "@/lib/oidc-client";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "forbidden";
type AuthRefreshResult = {
  status: AuthStatus;
  error: string | null;
};
type AuthRefreshOptions = {
  silent?: boolean;
};

type AuthContextValue = {
  status: AuthStatus;
  user: ApiWhoAmI | null;
  error: string | null;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (options?: AuthRefreshOptions) => Promise<AuthRefreshResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiWhoAmI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectingToLogin = useRef(false);

  const redirectToLogin = () => {
    if (redirectingToLogin.current) {
      return;
    }
    redirectingToLogin.current = true;
    const pathname = window.location.pathname;
    const path = `${pathname}${window.location.search}`;
    const returnTo = pathname.startsWith("/auth/") || pathname === "/login" || pathname === "/forbidden" ? "/" : path;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const refresh = async (options: AuthRefreshOptions = {}): Promise<AuthRefreshResult> => {
    const token = getAccessToken();
    if (!token) {
      redirectingToLogin.current = false;
      setStatus("anonymous");
      setUser(null);
      setError(null);
      return { status: "anonymous", error: null };
    }
    if (!options.silent) {
      setStatus("loading");
    }
    rememberAccessTokenClaims(token);
    try {
      const nextUser = await whoami();
      redirectingToLogin.current = false;
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
        if (options.silent) {
          redirectToLogin();
        }
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

  useEffect(() => {
    const handler = (error: ApiRequestError) => {
      clearTokens();
      setStatus("anonymous");
      setUser(null);
      setError(error.message);
      redirectToLogin();
    };
    setAuthFailureHandler(handler);
    return () => setAuthFailureHandler(null);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh({ silent: true });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      login: (returnTo) => startLogin(returnTo),
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

