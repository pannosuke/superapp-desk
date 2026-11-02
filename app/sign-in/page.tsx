import { Suspense } from "react";
import { SignInScreen } from "@/components/sign-in-screen";

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading sign-in…</p>}>
      <SignInScreen />
    </Suspense>
  );
}
