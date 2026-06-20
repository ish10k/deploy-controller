import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCcw, ShieldAlert, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { completeLogin } from "@/lib/oidc-client";
import { useAuth } from "@/lib/auth-context";

let loginCompletion: Promise<{ returnTo: string; explicitReturnTo: boolean }> | null = null;

function workspaceSelectorPath(returnTo: string) {
  if (
    !returnTo ||
    returnTo === "/" ||
    returnTo.startsWith("/auth/") ||
    returnTo.startsWith("/login") ||
    returnTo.startsWith("/forbidden") ||
    returnTo.startsWith("/workspaces/select")
  ) {
    return "/workspaces/select";
  }
  return `/workspaces/select?returnTo=${encodeURIComponent(returnTo)}`;
}

export function LoginPage() {
  const auth = useAuth();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") ?? undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white text-slate-950 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with your account to continue.
          </p>
          {auth.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{auth.error}</p> : null}
          <Button className="mt-6 w-full" onClick={() => void auth.login(returnTo)}>
            Sign-in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loginCompletion ??= completeLogin(window.location.href);
    loginCompletion
      .then(async ({ returnTo, explicitReturnTo }) => {
        if (cancelled) return;
        const result = await auth.refresh();
        if (result.status !== "authenticated") {
          loginCompletion = null;
          setError(result.error ?? "We could not finish signing you in. Please try again.");
          return;
        }
        loginCompletion = null;
        await navigate({ to: explicitReturnTo ? returnTo : workspaceSelectorPath(returnTo), replace: true });
      })
      .catch((caught) => {
        if (cancelled) return;
        loginCompletion = null;
        setError(caught instanceof Error ? caught.message : "We could not finish signing you in.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-7">
          {error ? (
            <>
              <ShieldAlert className="h-8 w-8 text-red-600" />
              <h1 className="mt-4 text-xl font-bold">Sign in did not finish</h1>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <Button className="mt-5" onClick={() => void auth.login()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <RefreshCcw className="h-8 w-8 animate-spin text-blue-600" />
              <h1 className="mt-4 text-xl font-bold">Signing you in...</h1>
              <p className="mt-2 text-sm text-slate-600">One moment while we get your account ready.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ForbiddenPage() {
  const auth = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-7">
          <ShieldAlert className="h-9 w-9 text-amber-600" />
          <h1 className="mt-4 text-2xl font-bold">Access is not enabled</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your OIDC login succeeded, but no active Settle Principal is registered for this issuer and subject.
          </p>
          {auth.error ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{auth.error}</p> : null}
          <div className="mt-5 flex gap-2">
            <Button onClick={() => void auth.logout()}>Sign out</Button>
            <Button variant="outline" onClick={() => void auth.refresh()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
