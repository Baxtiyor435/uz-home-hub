import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDeviceId } from "@/lib/device";
import { normalizePhone } from "@/lib/format";
import { useTr } from "@/lib/i18n";
import { signInWithPassword } from "@/lib/auth.functions";
import { createSuperAdminOwner, getSuperAdminSetupState } from "@/lib/super-admin-setup.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-kirish")({
  head: () => ({
    meta: [
      { title: "Super admin kirish — UBU" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminEntryPage,
});

function SuperAdminEntryPage() {
  const tr = useTr();
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["super-admin-setup"],
    queryFn: () => getSuperAdminSetupState({ data: undefined }),
  });
  const needsSetup = data?.needsSetup !== false;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function applySession(accessToken: string, refreshToken: string) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    await router.navigate({ to: "/super-admin" });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error(tr("Telefon raqamini to'liq kiriting", "Введите номер телефона полностью"));
      return;
    }
    if (password.length < 6) {
      toast.error(tr("Parol kamida 6 belgidan iborat bo'lsin", "Пароль должен содержать не менее 6 символов"));
      return;
    }
    if (needsSetup && password !== confirm) {
      toast.error(tr("Parollar mos kelmadi", "Пароли не совпадают"));
      return;
    }
    const deviceId = getDeviceId();
    if (!deviceId) {
      toast.error(tr("Qurilmani aniqlab bo'lmadi", "Не удалось определить устройство"));
      return;
    }

    setPending(true);
    try {
      if (needsSetup) {
        await createSuperAdminOwner({
          data: { phone: normalized, fullName: fullName.trim() || "Super admin", password, deviceId },
        });
        await refetch();
      }
      const result = await signInWithPassword({ data: { phone: normalized, password, deviceId } });
      if (!result.ok) {
        toast.error("message" in result ? result.message : tr("Kirib bo'lmadi", "Не удалось войти"));
        return;
      }
      await applySession(result.accessToken, result.refreshToken);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Amalni bajarib bo'lmadi", "Не удалось выполнить действие"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-6" />
      <div className="surface-card w-full max-w-sm p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <h1 className="font-display text-xl font-bold">
              {needsSetup ? tr("Super admin parolini yarating", "Создайте пароль супер-админа") : tr("Super admin kirish", "Вход супер-админа")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {needsSetup
                ? tr("Bu parolni keyin sozlamalardan o'zgartirish mumkin. Kod kerak emas.", "Этот пароль потом можно сменить в настройках. Код не нужен.")
                : tr("Telefon raqam va parol bilan kiring.", "Войдите по номеру телефона и паролю.")}
            </p>
          </div>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {needsSetup && (
            <div className="space-y-2">
              <Label htmlFor="owner-name">{tr("Ism", "Имя")}</Label>
              <Input id="owner-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="owner-phone">{tr("Telefon", "Телефон")}</Label>
            <Input id="owner-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-password">{tr("Parol", "Пароль")}</Label>
            <Input id="owner-password" type="password" autoComplete={needsSetup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {needsSetup && (
            <div className="space-y-2">
              <Label htmlFor="owner-confirm">{tr("Parolni tasdiqlang", "Подтвердите пароль")}</Label>
              <Input id="owner-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending || isLoading}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsSetup ? tr("Parolni saqlash va kirish", "Сохранить пароль и войти") : tr("Kirish", "Войти")}
          </Button>
          <Button variant="link" asChild className="w-full">
            <Link to="/">{tr("Bosh sahifa", "Главная")}</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
