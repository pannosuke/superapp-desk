import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowedEmail, isAuthConfigured } from "@/lib/env";

function isPublic(pathname: string, method: string) {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/sign-in") return true;
  if (pathname === "/api/feed" && method === "POST") return true;
  return false;
}

export const proxy = auth((request) => {
  if (!isAuthConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname, request.method)) return NextResponse.next();

  const email = request.auth?.user?.email?.toLowerCase() ?? "";
  const signedIn = email.length > 0 && email === allowedEmail();
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: email ? "Not allowlisted" : "Sign in required", authRequired: true },
      { status: email ? 403 : 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  if (email) url.searchParams.set("error", "AccessDenied");
  else url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
