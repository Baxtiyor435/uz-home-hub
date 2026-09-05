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
import { APP_SLOGAN } from "@/lib/uz";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Kirish — UBU Real Estate" },
      { name: "description", content: "Telefon raqam va parol orqali UBU Real Estate hisobiga kiring." },
      { property: "og:title", content: "Kirish — UBU Real Estate" },
      { property: "og:description", content: APP_SLOGAN },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
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
      toast.error("Sessiyani ochishda xatolik yuz berdi");
      return;
    }
    toast.success("Xush kelibsiz!");
    navigate({ to: "/", replace: true });
  };

  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!challenge) throw new Error("Sessiya muddati tugadi. Qaytadan kiring");
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
      if (!normalized) throw new Error("Telefon raqamini to'liq kiriting");
      if (password.length < 6) throw new Error("Parol kamida 6 belgidan iborat bo'lsin");
      const deviceId = getDeviceId();
      if (!deviceId) throw new Error("Qurilmani aniqlab bo'lmadi. Brauzer sozlamalarini tekshiring");
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
              <h1 className="font-display text-xl font-bold">Ikki bosqichli tasdiqlash</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Authenticator ilovangizdagi 6 xonali kodni kiriting. Zaxira kodni ham ishlatishingiz
                mumkin.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totp">Tasdiqlash kodi</Label>
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
              Tasdiqlash
            </Button>

            <button
              type="button"
              className="text-muted-foreground w-full text-center text-sm"
              onClick={() => {
                setChallenge(null);
                setTotpCode("");
              }}
            >
              Orqaga qaytish
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
              {mode === "login" ? "Tizimga kirish" : "Ro'yxatdan o'tish"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {mode === "login"
                ? "Telefon raqamingiz va parolingizni kiriting."
                : "Telefon raqamingiz va yangi parol bilan hisob yarating."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon raqam</Label>
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
              <Label htmlFor="fullName">Ism familiya (ixtiyoriy)</Label>
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
            <Label htmlFor="password">Parol</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Kamida 6 ta belgi"
              required
            />
          </div>

          <p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
            Diqqat: bitta hisob faqat bitta qurilmaga bog'lanadi. Boshqa telefon yoki kompyuterdan
            kirish uchun administratorga murojaat qiling.
          </p>

          <Button type="submit" className="w-full" disabled={authMutation.isPending}>
            {authMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
          </Button>

          <button
            type="button"
            className="text-muted-foreground w-full text-center text-sm"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? (
              <>
                Hisobingiz yo'qmi?{" "}
                <span className="text-primary font-medium">Ro'yxatdan o'ting</span>
              </>
            ) : (
              <>
                Hisobingiz bormi? <span className="text-primary font-medium">Kirish</span>
              </>
            )}
          </button>
        </form>
      </div>

      <Link to="/" className="text-muted-foreground mt-6 text-sm hover:underline">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
