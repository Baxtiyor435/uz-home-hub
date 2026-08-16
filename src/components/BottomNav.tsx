import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Heart, Home, KeyRound, User } from "lucide-react";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/sotuv", key: "nav.sale", icon: Building2 },
  { to: "/ijara", key: "nav.rent", icon: KeyRound },
  { to: "/sevimlilar", key: "nav.favorites", icon: Heart },
  { to: "/profil", key: "nav.profile", icon: User },
] as const;

export function BottomNav() {
  const { t } = useLang();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      aria-label={t("nav.main")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
