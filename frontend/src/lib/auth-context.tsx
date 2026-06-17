import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiRequestError, whoami, type ApiWhoAmI } from "@/lib/api-client";
import { clearTokens, getAccessToken } from "@/lib/auth-token";
import { logout, startLogin } from "@/lib/oidc-client";

type AuthStatus = "loading" | "anonymous" | "authenticated" | "forbidden";

type AuthContextValue = {
  status: AuthStatus;
  user: ApiWhoAmI | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthStatus>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiWhoAmI | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const token = getAccessToken();
    if (!token) {
      setStatus("anonymous");
      setUser(null);
      setError(null);
      return "anonymous";
    }
    setStatus("loading");
    try {
      const nextUser = await whoami();
      setUser(nextUser);
      setStatus("authenticated");
      setError(null);
      return "authenticated";
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 403) {
        setStatus("forbidden");
        setUser(null);
        setError(caught.message);
        return "forbidden";
      }
      if (caught instanceof ApiRequestError && caught.status === 401) {
        clearTokens();
        setStatus("anonymous");
        setUser(null);
        setError(caught.message);
        return "anonymous";
      }
      setStatus("forbidden");
      setUser(null);
      setError(caught instanceof Error ? caught.message : "Unable to authenticate.");
      return "forbidden";
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
