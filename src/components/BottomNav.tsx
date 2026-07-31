import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Heart, Home, KeyRound, User } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Bosh sahifa", icon: Home },
  { to: "/sotuv", label: "Sotuv", icon: Building2 },
  { to: "/ijara", label: "Ijara", icon: KeyRound },
  { to: "/sevimlilar", label: "Sevimlilar", icon: Heart },
  { to: "/profil", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      aria-label="Asosiy menyu"
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
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
