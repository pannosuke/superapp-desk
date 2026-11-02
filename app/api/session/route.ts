import { connection } from "next/server";
import { auth } from "@/auth";
import { allowedEmail, isAuthConfigured, missingAuthEnv, storageMode } from "@/lib/env";
import { json } from "@/lib/session";

export async function GET() {
  await connection();
  if (!isAuthConfigured()) {
    return json({
      configured: false,
      authRequired: false,
      email: null,
      missing: missingAuthEnv(),
      storage: storageMode(),
    });
  }
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email || email !== allowedEmail()) {
    return json({ error: "Sign in required", authRequired: true }, 401);
  }
  return json({
    configured: true,
    authRequired: true,
    email,
    storage: storageMode(),
  });
}
