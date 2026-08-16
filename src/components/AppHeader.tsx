import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Globe, LogOut, Plus, Shield, UserRound } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/sotuv", key: "nav.sale" },
  { to: "/ijara", key: "nav.rent" },
  { to: "/agentlar", key: "nav.agents" },
] as const;

export function AppHeader() {
  const { user, profile, isStaff, loading } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="bg-background/90 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t("nav.sections")}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.to)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 px-2"
            aria-label={t("header.language")}
            onClick={() => setLang(lang === "uz" ? "ru" : "uz")}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase">{lang === "uz" ? "RU" : "UZ"}</span>
          </Button>

          {user && (
            <Button variant="ghost" size="icon" asChild aria-label={t("header.notifications")}>
              <Link to="/bildirishnomalar">
                <Bell className="h-5 w-5" />
              </Link>
            </Button>
          )}

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/joylash">
              <Plus className="mr-1 h-4 w-4" />
              {t("header.create")}
            </Link>
          </Button>

          {loading ? (
            <div className="bg-muted h-9 w-9 animate-pulse rounded-full" aria-hidden="true" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("header.account")}>
                  <UserRound className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {profile?.full_name || t("header.user")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profil">{t("header.myProfile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/mening-elonlarim">{t("header.myListings")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/sevimlilar">{t("nav.favorites")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/suhbatlar">{t("header.chats")}</Link>
                </DropdownMenuItem>
                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        {t("header.admin")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("header.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Kirish</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
