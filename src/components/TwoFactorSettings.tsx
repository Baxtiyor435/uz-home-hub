import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTr } from "@/lib/i18n";
import { confirmMfaSetup, disableMfa, getMfaStatus, startMfaSetup } from "@/lib/mfa.functions";

type Stage = "idle" | "password" | "scan" | "codes" | "disable";

export function TwoFactorSettings() {
  const tr = useTr();
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
    onError: () => toast.error(tr("Xatolik yuz berdi", "Произошла ошибка")),
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
      toast.success(tr("2FA muvaffaqiyatli yoqildi", "2FA успешно включена"));
      void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
    onError: () => toast.error(tr("Kod noto'g'ri", "Неверный код")),
  });

  const turnOff = useMutation({
    mutationFn: () => disableMfa({ data: { password, code: code.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? tr("Xatolik", "Ошибка"));
        return;
      }
      toast.success(tr("2FA o'chirildi", "2FA отключена"));
      reset();
      void queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    },
    onError: () => toast.error(tr("Xatolik yuz berdi", "Произошла ошибка")),
  });

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="text-primary h-4 w-4" />
            {tr("Ikki bosqichli himoya (2FA)", "Двухфакторная защита (2FA)")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {tr("Google Authenticator, Microsoft Authenticator yoki Aegis ilovasi orqali hisobingizni himoyalang.", "Защитите свой аккаунт с помощью Google Authenticator, Microsoft Authenticator или Aegis.")}
          </p>
        </div>
        {status?.enabled && (
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
            {tr("Yoqilgan", "Включено")}
          </span>
        )}
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

      {!isLoading && !status?.enabled && stage === "idle" && (
        <Button onClick={() => setStage("password")}>{tr("2FA ni yoqish", "Включить 2FA")}</Button>
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
            <Label htmlFor="mfa-password">{tr("Parolingizni tasdiqlang", "Подтвердите ваш пароль")}</Label>
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
              {tr("Davom etish", "Продолжить")}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {tr("Bekor qilish", "Отмена")}
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
          <p className="text-sm font-medium">{tr("QR kodni Authenticator ilovangiz bilan skaner qiling", "Отсканируйте QR-код в приложении Authenticator")}</p>
          <img
            src={setup.qrDataUrl}
            alt={tr("2FA uchun QR kod", "QR-код для 2FA")}
            className="bg-background mx-auto rounded-lg border p-2"
            width={220}
            height={220}
          />
          <div className="space-y-1">
            <Label>{tr("Qo'lda kiritish uchun kalit", "Ключ для ручного ввода")}</Label>
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
                  toast.success(tr("Nusxalandi", "Скопировано"));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">{tr("Ilovadagi 6 xonali kod", "6-значный код из приложения")}</Label>
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
              {tr("Tasdiqlash va yoqish", "Подтвердить и включить")}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {tr("Bekor qilish", "Отмена")}
            </Button>
          </div>
        </form>
      )}

      {stage === "codes" && backupCodes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{tr("2FA muvaffaqiyatli yoqildi", "2FA успешно включена")}</p>
          <p className="text-muted-foreground text-sm">
            {tr("Quyidagi zaxira kodlarni xavfsiz joyda saqlang. Har biri faqat bir marta ishlaydi va bu kodlar boshqa ko'rsatilmaydi.", "Сохраните резервные коды в надёжном месте. Каждый работает только один раз, и повторно они не показываются.")}
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
                toast.success(tr("Zaxira kodlar nusxalandi", "Резервные коды скопированы"));
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {tr("Nusxalash", "Копировать")}
            </Button>
            <Button
              onClick={() => {
                setBackupCodes([]);
                reset();
              }}
            >
              {tr("Saqladim", "Сохранил(а)")}
            </Button>
          </div>
        </div>
      )}

      {status?.enabled && stage === "idle" && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {tr("Qolgan zaxira kodlar:", "Осталось резервных кодов:")} {status.backupCodesLeft}
          </p>
          <Button variant="outline" onClick={() => setStage("disable")}>
            <ShieldOff className="mr-2 h-4 w-4" />
            {tr("2FA ni o'chirish", "Отключить 2FA")}
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
            <Label htmlFor="off-password">{tr("Parol", "Пароль")}</Label>
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
            <Label htmlFor="off-code">{tr("Authenticator kodi", "Код Authenticator")}</Label>
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
              {tr("O'chirish", "Отключить")}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {tr("Bekor qilish", "Отмена")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
