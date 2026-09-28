import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTr } from "@/lib/i18n";
import { grantAdminWithCode } from "@/lib/admin-code.functions";

export const Route = createFileRoute("/admin/kirish")({
  head: () => ({
    meta: [
      { title: "Admin kirish — UBU" },
      { name: "description", content: "Admin paneliga kirish kodi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { user, isStaff, loading, refresh } = useAuth();
  const tr = useTr();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!loading && isStaff) {
      router.navigate({ to: "/admin" });
    }
  }, [loading, isStaff, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await grantAdminWithCode({ data: { code: code.trim() } });
      if (result.ok) {
        toast.success(tr("Admin huquqi faollashdi. Iltimos, kuting...", "Права администратора активированы. Пожалуйста, подождите..."));
        refresh();
        // The useEffect watching isStaff will redirect to /admin once the role refetches.
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Kod noto'g'ri", "Неверный код"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // After hydration, if the user is definitely not logged in, prompt them to sign in.
  if (hydrated && !loading && !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">{tr("Admin panel", "Админ панель")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {tr("Admin huquqlarini olish uchun avval tizimga kiring.", "Сначала войдите в аккаунт, чтобы получить права администратора.")}
          </p>
          <Button asChild className="mt-6">
            <Link to="/auth">{tr("Kirish", "Войти")}</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold">{tr("Admin paneliga kirish", "Вход в админ панель")}</h1>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          {tr("Sizga berilgan maxsus kodni kiriting.", "Введите выданный вам специальный код.")}
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-code">{tr("Kirish kodi", "Код доступа")}</Label>
            <Input
              id="admin-code"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="********"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? tr("Tekshirilmoqda...", "Проверка...") : tr("Kirish", "Войти")}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Button variant="link" asChild>
            <Link to="/">{tr("Bosh sahifa", "Главная")}</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
