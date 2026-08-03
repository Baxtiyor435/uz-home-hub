import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { sendOtp, verifyOtp } from "@/lib/auth.functions";
import { normalizePhone } from "@/lib/format";
import { APP_SLOGAN } from "@/lib/uz";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Kirish — UBU Real Estate" },
      { name: "description", content: "Telefon raqamingiz orqali UBU Real Estate hisobiga kiring." },
      { property: "og:title", content: "Kirish — UBU Real Estate" },
      { property: "og:description", content: APP_SLOGAN },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error("Telefon raqamini to'liq kiriting");
      return sendOtp({ data: { phone: normalized, fullName: fullName.trim() } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setStep("code");
      setCountdown(result.resendAfter);
      toast.success("Tasdiqlash kodi SMS orqali yuborildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error("Telefon raqami noto'g'ri");
      return verifyOtp({ data: { phone: normalized, code, fullName: fullName.trim() } });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message);
        setCode("");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) {
        toast.error("Sessiyani ochishda xatolik yuz berdi");
        return;
      }
      toast.success("Xush kelibsiz!");
      navigate({ to: "/", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-6" />

      <div className="surface-card w-full max-w-sm p-6">
        {step === "phone" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              sendMutation.mutate();
            }}
          >
            <div>
              <h1 className="font-display text-xl font-bold">Tizimga kirish</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Telefon raqamingizga tasdiqlash kodi yuboramiz.
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

            <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
              {sendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kod yuborish
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              verifyMutation.mutate();
            }}
          >
            <div>
              <h1 className="font-display text-xl font-bold">Kodni kiriting</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {phone} raqamiga yuborilgan 6 xonali kodni kiriting.
              </p>
              <p className="bg-muted text-muted-foreground mt-3 rounded-md px-3 py-2 text-xs">
                Demo rejimi: SMS hozircha yuborilmaydi. Kirish uchun{" "}
                <span className="text-foreground font-semibold">123456</span> kodini kiriting.
              </p>
            </div>


            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={verifyMutation.isPending || code.length !== 6}
            >
              {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tasdiqlash
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground inline-flex items-center gap-1"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Raqamni o'zgartirish
              </button>
              <button
                type="button"
                className="text-primary disabled:text-muted-foreground font-medium"
                disabled={countdown > 0 || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {countdown > 0 ? `Qayta yuborish (${countdown})` : "Qayta yuborish"}
              </button>
            </div>
          </form>
        )}
      </div>

      <Link to="/" className="text-muted-foreground mt-6 text-sm hover:underline">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
