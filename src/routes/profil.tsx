import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, LogOut, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import { redeemStaffCode } from "@/lib/staff.functions";
import { DEFAULT_PREMIUM_PRICE, ROLE_LABELS } from "@/lib/uz";
import { useTr } from "@/lib/i18n";


export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — UBU" },
      { name: "description", content: "Profil ma'lumotlaringiz, agentlik arizasi va hisob sozlamalari." },
      { property: "og:title", content: "Profil — UBU" },
      { property: "og:description", content: "Hisob sozlamalari." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, isAgent, isStaff, isSuperAdmin, isPremium, loading, refresh } =
    useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tr = useTr();
  const [adminCode, setAdminCode] = useState("");
  const [superCode, setSuperCode] = useState("");

  const redeem = useMutation({
    mutationFn: (code: string) => redeemStaffCode({ data: { code } }),
    onSuccess: (result) => {
      refresh();
      setAdminCode("");
      setSuperCode("");
      toast.success(
        result.role === "super_admin"
          ? tr("Super admin huquqi berildi", "Права супер-администратора предоставлены")
          : tr("Admin huquqi berildi", "Права администратора предоставлены"),
      );
      navigate({ to: result.role === "super_admin" ? "/super-admin" : "/admin" });
    },
    onError: () => toast.error(tr("Kod noto'g'ri", "Неверный код")),
  });


  const { data: application } = useQuery({
    queryKey: ["agent-application", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_applications")
        .select("id, status, reject_reason, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!user) throw new Error("AUTH");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: String(formData.get("full_name") ?? "").trim().slice(0, 100),
          bio: String(formData.get("bio") ?? "").trim().slice(0, 500),
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success(tr("Profil saqlandi", "Профиль сохранён"));
    },
    onError: () => toast.error(tr("Profilni saqlab bo'lmadi", "Не удалось сохранить профиль")),
  });

  const applyAgent = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!user) throw new Error("AUTH");
      const { error } = await supabase.from("agent_applications").insert({
        user_id: user.id,
        full_name: String(formData.get("app_full_name") ?? "").trim().slice(0, 100),
        agency_name: String(formData.get("agency_name") ?? "").trim().slice(0, 100),
        phone: profile?.phone ?? "",
        experience_years: Number(formData.get("experience_years") ?? 0),
        message: String(formData.get("message") ?? "").trim().slice(0, 1000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-application", user?.id] });
      toast.success(tr("Ariza yuborildi. Administrator ko'rib chiqadi", "Заявка отправлена. Администратор рассмотрит её"));
    },
    onError: () => toast.error(tr("Arizani yuborib bo'lmadi", "Не удалось отправить заявку")),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!loading && !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-xl font-bold">{tr("Profilni ko'rish uchun tizimga kiring", "Войдите, чтобы посмотреть профиль")}</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">{tr("Kirish", "Войти")}</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="font-display text-2xl font-bold">
              {profile?.full_name || tr("Foydalanuvchi", "Пользователь")}
            </h1>
            <p className="text-muted-foreground text-sm">{formatPhone(profile?.phone)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
              {isPremium && <Badge>Premium</Badge>}
              {profile?.is_verified_agent && (
                <Badge variant="outline">
                  <Star className="mr-1 h-3 w-3 fill-current" />
                  {Number(profile.rating).toFixed(1)} ({profile.reviews_count})
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {tr("Chiqish", "Выйти")}
          </Button>
        </header>

        <section className="surface-card p-5">
          <h2 className="font-display mb-4 text-lg font-semibold">{tr("Profil ma'lumotlari", "Данные профиля")}</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveProfile.mutate(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">{tr("Ism familiya", "Имя и фамилия")}</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">{tr("O'zingiz haqingizda", "О себе")}</Label>
              <Textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={profile?.bio ?? ""} />
            </div>
            <Button type="submit" disabled={saveProfile.isPending}>
              {tr("Saqlash", "Сохранить")}
            </Button>
          </form>
        </section>

        <TwoFactorSettings />

        <section className="surface-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Crown className="text-primary h-5 w-5" aria-hidden="true" />
                {tr("Premium obuna", "Premium подписка")}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {isPremium && profile?.premium_until
                  ? tr(
                      `Obunangiz ${formatDate(profile.premium_until)} gacha faol.`,
                      `Ваша подписка активна до ${formatDate(profile.premium_until)}.`,
                    )
                  : tr(
                      `Oyiga ${formatPrice(DEFAULT_PREMIUM_PRICE, "UZS")} — kontaktlar cheksiz, e'lonlar yuqorida.`,
                      `${formatPrice(DEFAULT_PREMIUM_PRICE, "UZS")} в месяц — контакты без ограничений, объявления выше в списке.`,
                    )}
              </p>
            </div>
          </div>
          <Button asChild className="mt-4">
            <Link to="/obuna">{isPremium ? tr("Obunani boshqarish", "Управление подпиской") : tr("Obuna sotib olish", "Купить подписку")}</Link>
          </Button>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="text-primary h-5 w-5" aria-hidden="true" />
            {tr("Admin panelga o'tish", "Перейти в панель администратора")}
          </h2>
          {isStaff ? (
            <Button asChild className="mt-4">
              <Link to="/admin">{tr("Admin panelni ochish", "Открыть панель администратора")}</Link>
            </Button>
          ) : (
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                redeem.mutate(adminCode.trim());
              }}
            >
              <Input
                aria-label={tr("Admin kirish kodi", "Код входа администратора")}
                placeholder={tr("Admin kodi", "Код администратора")}
                className="max-w-xs"
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
              />
              <Button type="submit" disabled={redeem.isPending || !adminCode.trim()}>
                {tr("Kirish", "Войти")}
              </Button>
            </form>
          )}

          <div className="border-border/60 mt-6 border-t pt-5">
            <h3 className="font-display flex items-center gap-2 text-base font-semibold">
              <Crown className="text-primary h-4 w-4" aria-hidden="true" />
              {tr("Super admin panelga o'tish", "Перейти в панель супер-администратора")}
            </h3>
            {isSuperAdmin ? (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/super-admin">{tr("Super admin panelni ochish", "Открыть панель супер-администратора")}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/super-kirish">{tr("Super admin sahifasini ochish", "Открыть страницу супер-админа")}</Link>
              </Button>
            )}
          </div>
        </section>


        <section className="surface-card p-5">
          <h2 className="font-display mb-2 text-lg font-semibold">{tr("Agentlik maqomi", "Статус агента")}</h2>
          {isAgent ? (
            <p className="text-muted-foreground text-sm">
              {tr(
                "Siz tasdiqlangan agentsiz va sotuv e'lonlarini joylashtira olasiz.",
                "Вы проверенный агент и можете размещать объявления о продаже.",
              )}
            </p>
          ) : application?.status === "pending" ? (
            <p className="text-muted-foreground text-sm">
              {tr(
                `Arizangiz ${formatDate(application.created_at)} sanasida yuborilgan va ko'rib chiqilmoqda.`,
                `Ваша заявка отправлена ${formatDate(application.created_at)} и рассматривается.`,
              )}
            </p>
          ) : (
            <>
              {application?.status === "rejected" && (
                <p className="text-destructive mb-3 text-sm">
                  {tr("Oldingi ariza rad etilgan", "Предыдущая заявка отклонена")}: {application.reject_reason || tr("sabab ko'rsatilmagan", "причина не указана")}
                </p>
              )}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyAgent.mutate(new FormData(event.currentTarget));
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="app_full_name">{tr("To'liq ism", "Полное имя")}</Label>
                    <Input
                      id="app_full_name"
                      name="app_full_name"
                      required
                      maxLength={100}
                      defaultValue={profile?.full_name ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agency_name">{tr("Agentlik nomi", "Название агентства")}</Label>
                    <Input id="agency_name" name="agency_name" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience_years">{tr("Tajriba (yil)", "Опыт (лет)")}</Label>
                    <Input
                      id="experience_years"
                      name="experience_years"
                      type="number"
                      min={0}
                      max={60}
                      defaultValue={0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">{tr("Qo'shimcha ma'lumot", "Дополнительная информация")}</Label>
                  <Textarea id="message" name="message" rows={3} maxLength={1000} />
                </div>
                <Button type="submit" disabled={applyAgent.isPending}>
                  {tr("Ariza yuborish", "Отправить заявку")}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
