import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmMfaSetup, disableMfa, getMfaStatus, startMfaSetup } from "@/lib/mfa.functions";

type Stage = "idle" | "password" | "scan" | "codes" | "disable";

export function TwoFactorSettings() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const { data: status, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => getMfaStatus(),
  });

  const reset = () => {
    setStage("idle");
    setPassword("");
    setCode("");
    setSetup(null);
  };

  const start = useMutation({
    mutationFn: () => startMfaSetup({ data: { password } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setSetup({ qrDataUrl: result.qrDataUrl, manualKey: result.manualKey });
      setPassword("");
      setStage("scan");
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  const confirm = useMutation({
    mutationFn: () => confirmMfaSetup({ data: { code: code.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setBackupCodes(result.backupCodes);
      setSetup(null);
      setCode("");
      setStage("codes");
      toast.success("2FA muvaffaqiyatli yoqildi");
      void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
    onError: () => toast.error("Kod noto'g'ri"),
  });

  const turnOff = useMutation({
    mutationFn: () => disableMfa({ data: { password, code: code.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Xatolik");
        return;
      }
      toast.success("2FA o'chirildi");
      reset();
      void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="text-primary h-4 w-4" />
            Ikki bosqichli himoya (2FA)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Google Authenticator, Microsoft Authenticator yoki Aegis ilovasi orqali hisobingizni
            himoyalang.
          </p>
        </div>
        {status?.enabled && (
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
            Yoqilgan
          </span>
        )}
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

      {!isLoading && !status?.enabled && stage === "idle" && (
        <Button onClick={() => setStage("password")}>2FA ni yoqish</Button>
      )}

      {!status?.enabled && stage === "password" && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            start.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="mfa-password">Parolingizni tasdiqlang</Label>
            <Input
              id="mfa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={start.isPending}>
              {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Davom etish
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Bekor qilish
            </Button>
          </div>
        </form>
      )}

      {stage === "scan" && setup && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            confirm.mutate();
          }}
        >
          <p className="text-sm font-medium">QR kodni Authenticator ilovangiz bilan skaner qiling</p>
          <img
            src={setup.qrDataUrl}
            alt="2FA uchun QR kod"
            className="bg-background mx-auto rounded-lg border p-2"
            width={220}
            height={220}
          />
          <div className="space-y-1">
            <Label>Qo'lda kiritish uchun kalit</Label>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-xs">
                {setup.manualKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(setup.manualKey);
                  toast.success("Nusxalandi");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Ilovadagi 6 xonali kod</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.4em]"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={confirm.isPending}>
              {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tasdiqlash va yoqish
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Bekor qilish
            </Button>
          </div>
        </form>
      )}

      {stage === "codes" && backupCodes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">2FA muvaffaqiyatli yoqildi</p>
          <p className="text-muted-foreground text-sm">
            Quyidagi zaxira kodlarni xavfsiz joyda saqlang. Har biri faqat bir marta ishlaydi va bu
            kodlar boshqa ko'rsatilmaydi.
          </p>
          <div className="bg-muted grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm">
            {backupCodes.map((backupCode) => (
              <span key={backupCode}>{backupCode}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(backupCodes.join("\n"));
                toast.success("Zaxira kodlar nusxalandi");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Nusxalash
            </Button>
            <Button
              onClick={() => {
                setBackupCodes([]);
                reset();
              }}
            >
              Saqladim
            </Button>
          </div>
        </div>
      )}

      {status?.enabled && stage === "idle" && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Qolgan zaxira kodlar: {status.backupCodesLeft}
          </p>
          <Button variant="outline" onClick={() => setStage("disable")}>
            <ShieldOff className="mr-2 h-4 w-4" />
            2FA ni o'chirish
          </Button>
        </div>
      )}

      {status?.enabled && stage === "disable" && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            turnOff.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="off-password">Parol</Label>
            <Input
              id="off-password"
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="off-code">Authenticator kodi</Label>
            <Input
              id="off-code"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={turnOff.isPending}>
              {turnOff.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              O'chirish
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Bekor qilish
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
