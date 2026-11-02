import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID, {
  type MicrosoftEntraIDProfile,
} from "next-auth/providers/microsoft-entra-id";
import {
  allowedEmail,
  graphScopes,
  isAuthConfigured,
} from "@/lib/env";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    user: DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}

const SCOPES = graphScopes();

async function refreshAccessToken(refreshToken: string) {
  const tenant = process.env.AZURE_AD_TENANT_ID?.trim();
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !clientSecret) return null;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: SCOPES,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token || !json.expires_in) return null;
  return json;
}

function profileEmail(profile: MicrosoftEntraIDProfile | undefined, fallback?: string | null) {
  const email = profile?.email || profile?.preferred_username || fallback || "";
  return email.toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || "desk-setup-mode-do-not-deploy",
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: isAuthConfigured()
    ? [
        MicrosoftEntraID({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
          authorization: { params: { scope: SCOPES } },
        }),
      ]
    : [],
  callbacks: {
    async signIn({ profile, user }) {
      const entra = profile as unknown as MicrosoftEntraIDProfile | undefined;
      const tenant = process.env.AZURE_AD_TENANT_ID?.trim().toLowerCase();
      if (entra?.tid && tenant && entra.tid.toLowerCase() !== tenant) return false;
      const email = profileEmail(entra, user.email);
      return email.length > 0 && email === allowedEmail();
    },
    async jwt({ token, account, profile }) {
      if (profile) {
        const email = profileEmail(profile as unknown as MicrosoftEntraIDProfile, token.email);
        if (email) token.email = email;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
        token.error = undefined;
        return token;
      }
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }
      if (!token.refreshToken) {
        token.error = "RefreshAccessTokenError";
        return token;
      }
      const refreshed = await refreshAccessToken(token.refreshToken);
      if (!refreshed?.access_token) {
        token.error = "RefreshAccessTokenError";
        return token;
      }
      token.accessToken = refreshed.access_token;
      token.refreshToken = refreshed.refresh_token ?? token.refreshToken;
      token.expiresAt = Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600);
      token.error = undefined;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email;
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
