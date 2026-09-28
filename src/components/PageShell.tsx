import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { useTr } from "@/lib/i18n";
import { APP_SLOGAN } from "@/lib/uz";

export function PageShell({ children }: { children: ReactNode }) {
  const tr = useTr();
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <footer className="bg-card mt-12 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm">
          <Logo />
          <p>{tr(APP_SLOGAN, "Каждое объявление проверено. Каждая сделка безопасна.")}</p>
          <p className="text-xs">
            © {new Date().getFullYear()} UBU. {tr("Barcha huquqlar himoyalangan.", "Все права защищены.")}
          </p>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}
