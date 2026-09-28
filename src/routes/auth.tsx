import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword, signUpWithPassword } from "@/lib/auth.functions";
import { verifyMfaChallenge } from "@/lib/mfa.functions";
import { getDeviceId } from "@/lib/device";
import { normalizePhone } from "@/lib/format";
import { useTr } from "@/lib/i18n";
import { APP_SLOGAN } from "@/lib/uz";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Kirish — UBU" },
      { name: "description", content: "Telefon raqam va parol orqali UBU hisobiga kiring." },
      { property: "og:title", content: "Kirish — UBU" },
      { property: "og:description", content: APP_SLOGAN },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const tr = useTr();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; challengeToken: string } | null>(
    null,
  );
  const [totpCode, setTotpCode] = useState("");

  const applySession = async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      toast.error(tr("Sessiyani ochishda xatolik yuz berdi", "Ошибка при открытии сессии"));
      return;
    }
    toast.success(tr("Xush kelibsiz!", "Добро пожаловать!"));
    navigate({ to: "/", replace: true });
  };

  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!challenge) throw new Error(tr("Sessiya muddati tugadi. Qaytadan kiring", "Сессия истекла. Войдите снова"));
      return verifyMfaChallenge({ data: { ...challenge, code: totpCode.trim() } });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message);
        setTotpCode("");
        return;
      }
      await applySession(result.accessToken, result.refreshToken);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const authMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error(tr("Telefon raqamini to'liq kiriting", "Введите номер телефона полностью"));
      if (password.length < 6) throw new Error(tr("Parol kamida 6 belgidan iborat bo'lsin", "Пароль должен содержать не менее 6 символов"));
      const deviceId = getDeviceId();
      if (!deviceId) throw new Error(tr("Qurilmani aniqlab bo'lmadi. Brauzer sozlamalarini tekshiring", "Не удалось определить устройство. Проверьте настройки браузера"));
      return mode === "login"
        ? signInWithPassword({ data: { phone: normalized, password, deviceId } })
        : signUpWithPassword({
            data: { phone: normalized, password, fullName: fullName.trim(), deviceId },
          });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        if (result.mfaRequired) {
          setPassword("");
          setChallenge({ challengeId: result.challengeId, challengeToken: result.challengeToken });
          return;
        }
        toast.error(result.message);
        return;
      }
      await applySession(result.accessToken, result.refreshToken);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (challenge) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <Logo className="mb-6" />
        <div className="surface-card w-full max-w-sm p-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              mfaMutation.mutate();
            }}
          >
            <div>
              <h1 className="font-display text-xl font-bold">{tr("Ikki bosqichli tasdiqlash", "Двухфакторная аутентификация")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {tr("Authenticator ilovangizdagi 6 xonali kodni kiriting. Zaxira kodni ham ishlatishingiz mumkin.", "Введите 6-значный код из приложения Authenticator. Также можно использовать резервный код.")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totp">{tr("Tasdiqlash kodi", "Код подтверждения")}</Label>
              <Input
                id="totp"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                value={totpCode}
                maxLength={20}
                onChange={(event) => setTotpCode(event.target.value)}
                className="text-center text-lg tracking-[0.4em]"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={mfaMutation.isPending}>
              {mfaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Tasdiqlash", "Подтвердить")}
            </Button>

            <button
              type="button"
              className="text-muted-foreground w-full text-center text-sm"
              onClick={() => {
                setChallenge(null);
                setTotpCode("");
              }}
            >
              {tr("Orqaga qaytish", "Назад")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-6" />

      <div className="surface-card w-full max-w-sm p-6">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            authMutation.mutate();
          }}
        >
          <div>
            <h1 className="font-display text-xl font-bold">
              {mode === "login" ? tr("Tizimga kirish", "Вход в аккаунт") : tr("Ro'yxatdan o'tish", "Регистрация")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {mode === "login"
                ? tr("Telefon raqamingiz va parolingizni kiriting.", "Введите номер телефона и пароль.")
                : tr("Telefon raqamingiz va yangi parol bilan hisob yarating.", "Создайте аккаунт с номером телефона и новым паролем.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{tr("Telefon raqam", "Номер телефона")}</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              maxLength={20}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="fullName">{tr("Ism familiya (ixtiyoriy)", "Имя и фамилия (необязательно)")}</Label>
              <Input
                id="fullName"
                value={fullName}
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alisher Rasulov"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{tr("Parol", "Пароль")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={tr("Kamida 6 ta belgi", "Минимум 6 символов")}
              required
            />
          </div>

          <p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
            {tr("Diqqat: bitta hisob faqat bitta qurilmaga bog'lanadi. Boshqa telefon yoki kompyuterdan kirish uchun administratorga murojaat qiling.", "Внимание: один аккаунт привязывается только к одному устройству. Для входа с другого телефона или компьютера обратитесь к администратору.")}
          </p>

          <Button type="submit" className="w-full" disabled={authMutation.isPending}>
            {authMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? tr("Kirish", "Войти") : tr("Ro'yxatdan o'tish", "Регистрация")}
          </Button>

          <button
            type="button"
            className="text-muted-foreground w-full text-center text-sm"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? (
              <>
                {tr("Hisobingiz yo'qmi?", "Нет аккаунта?")}{" "}
                <span className="text-primary font-medium">{tr("Ro'yxatdan o'ting", "Зарегистрироваться")}</span>
              </>
            ) : (
              <>
                {tr("Hisobingiz bormi?", "Уже есть аккаунт?")} <span className="text-primary font-medium">{tr("Kirish", "Войти")}</span>
              </>
            )}
          </button>
        </form>
      </div>

      <Link to="/" className="text-muted-foreground mt-6 text-sm hover:underline">
        {tr("Bosh sahifaga qaytish", "Вернуться на главную")}
      </Link>
    </div>
  );
}
