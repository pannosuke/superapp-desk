"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useApi } from "@/components/use-api";
import { Button } from "@/components/ui/button";

type SessionResponse = {
  configured?: boolean;
  missing?: string[];
  email?: string | null;
};

export function SignInScreen() {
  const params = useSearchParams();
  const session = useApi<SessionResponse>("/api/session");
  const denied = params.get("error") === "AccessDenied";
  const configured = session.data?.configured === true;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-medium">Desk</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Microsoft Entra, single tenant. Only the allowlisted mailbox can open Desk.
      </p>
      {denied ? (
        <p className="mt-4 text-sm text-destructive">That Microsoft account is not ALLOWED_EMAIL.</p>
      ) : null}
      {session.data?.configured === false ? (
        <p className="mt-6 text-sm">Not connected, set {(session.data.missing ?? []).join(", ")}</p>
      ) : null}
      {configured ? (
        <Button className="mt-6" onClick={() => void signIn("microsoft-entra-id", { callbackUrl: "/" })}>
          Continue with Microsoft
        </Button>
      ) : null}
      {session.loading ? <p className="mt-6 text-sm text-muted-foreground">Checking sign-in…</p> : null}
    </main>
  );
}
