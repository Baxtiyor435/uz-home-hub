import { Link, useRouterState } from "@tanstack/react-router";
import { Crown, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

/** Sahifalar: obuna bo'lmasa ham ochiq qoladi. */
const ALLOWED_PATHS = ["/auth", "/obuna", "/profil"];

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { user, loading, isPremium, isStaff } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const allowed =
    loading ||
    !user ||
    isPremium ||
    isStaff ||
    ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <Logo />
      <div className="surface-card w-full max-w-md p-8">
        <Lock className="text-primary mx-auto h-8 w-8" aria-hidden="true" />
        <h1 className="font-display mt-4 text-2xl font-bold">Obuna talab qilinadi</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Platformadan foydalanish uchun Premium obunani rasmiylashtiring. To'lov admin tomonidan
          tasdiqlangach barcha bo'limlar ochiladi.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/obuna">
              <Crown className="mr-2 h-4 w-4" aria-hidden="true" />
              Obuna sotib olish
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/profil">Profilim</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
