import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowedEmail, isAuthConfigured, missingAuthEnv } from "@/lib/env";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function requireSession() {
  if (!isAuthConfigured()) {
    return {
      ok: false as const,
      response: json(
        {
          error: "Sign-in is not configured",
          missing: missingAuthEnv(),
          authRequired: false,
        },
        401,
      ),
    };
  }
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email || email !== allowedEmail()) {
    return {
      ok: false as const,
      response: json({ error: "Not allowlisted", authRequired: true }, 403),
    };
  }
  return {
    ok: true as const,
    email,
    accessToken: session?.accessToken,
    error: session?.error,
  };
}

export async function requireGraph() {
  const session = await requireSession();
  if (!session.ok) return session;
  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return {
      ok: false as const,
      response: json(
        { error: "Microsoft session expired. Sign in again.", authRequired: true },
        401,
      ),
    };
  }
  return { ok: true as const, email: session.email, accessToken: session.accessToken };
}
