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
import { redeemStaffCode } from "@/lib/staff.functions";
import { DEFAULT_PREMIUM_PRICE, ROLE_LABELS } from "@/lib/uz";


export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — UBU Real Estate" },
      { name: "description", content: "Profil ma'lumotlaringiz, agentlik arizasi va hisob sozlamalari." },
      { property: "og:title", content: "Profil — UBU Real Estate" },
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
  const [adminCode, setAdminCode] = useState("");
  const [superCode, setSuperCode] = useState("");

  const redeem = useMutation({
    mutationFn: (code: string) => redeemStaffCode({ data: { code } }),
    onSuccess: (result) => {
      refresh();
      setAdminCode("");
      setSuperCode("");
      toast.success(
        result.role === "super_admin" ? "Super admin huquqi berildi" : "Admin huquqi berildi",
      );
      navigate({ to: result.role === "super_admin" ? "/super-admin" : "/admin" });
    },
    onError: () => toast.error("Kod noto'g'ri"),
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
      toast.success("Profil saqlandi");
    },
    onError: () => toast.error("Profilni saqlab bo'lmadi"),
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
      toast.success("Ariza yuborildi. Administrator ko'rib chiqadi");
    },
    onError: () => toast.error("Arizani yuborib bo'lmadi"),
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
          <h1 className="font-display text-xl font-bold">Profilni ko'rish uchun tizimga kiring</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">Kirish</Link>
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
              {profile?.full_name || "Foydalanuvchi"}
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
            Chiqish
          </Button>
        </header>

        <section className="surface-card p-5">
          <h2 className="font-display mb-4 text-lg font-semibold">Profil ma'lumotlari</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveProfile.mutate(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Ism familiya</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">O'zingiz haqingizda</Label>
              <Textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={profile?.bio ?? ""} />
            </div>
            <Button type="submit" disabled={saveProfile.isPending}>
              Saqlash
            </Button>
          </form>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Crown className="text-primary h-5 w-5" aria-hidden="true" />
                Premium obuna
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {isPremium && profile?.premium_until
                  ? `Obunangiz ${formatDate(profile.premium_until)} gacha faol.`
                  : `Oyiga ${formatPrice(DEFAULT_PREMIUM_PRICE, "UZS")} — kontaktlar cheksiz, e'lonlar yuqorida.`}
              </p>
            </div>
          </div>
          <Button asChild className="mt-4">
            <Link to="/obuna">{isPremium ? "Obunani boshqarish" : "Obuna sotib olish"}</Link>
          </Button>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="text-primary h-5 w-5" aria-hidden="true" />
            Admin panelga o'tish
          </h2>
          {isStaff ? (
            <Button asChild className="mt-4">
              <Link to="/admin">Admin panelni ochish</Link>
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
                aria-label="Admin kirish kodi"
                placeholder="Admin kodi"
                className="max-w-xs"
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
              />
              <Button type="submit" disabled={redeem.isPending || !adminCode.trim()}>
                Kirish
              </Button>
            </form>
          )}

          <div className="border-border/60 mt-6 border-t pt-5">
            <h3 className="font-display flex items-center gap-2 text-base font-semibold">
              <Crown className="text-primary h-4 w-4" aria-hidden="true" />
              Super admin panelga o'tish
            </h3>
            {isSuperAdmin ? (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/super-admin">Super admin panelni ochish</Link>
              </Button>
            ) : (
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  redeem.mutate(superCode.trim());
                }}
              >
                <Input
                  aria-label="Super admin kirish kodi"
                  placeholder="Super admin kodi"
                  className="max-w-xs"
                  value={superCode}
                  onChange={(event) => setSuperCode(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={redeem.isPending || !superCode.trim()}
                >
                  Kirish
                </Button>
              </form>
            )}
          </div>
        </section>


        <section className="surface-card p-5">
          <h2 className="font-display mb-2 text-lg font-semibold">Agentlik maqomi</h2>
          {isAgent ? (
            <p className="text-muted-foreground text-sm">
              Siz tasdiqlangan agentsiz va sotuv e'lonlarini joylashtira olasiz.
            </p>
          ) : application?.status === "pending" ? (
            <p className="text-muted-foreground text-sm">
              Arizangiz {formatDate(application.created_at)} sanasida yuborilgan va ko'rib chiqilmoqda.
            </p>
          ) : (
            <>
              {application?.status === "rejected" && (
                <p className="text-destructive mb-3 text-sm">
                  Oldingi ariza rad etilgan: {application.reject_reason || "sabab ko'rsatilmagan"}
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
                    <Label htmlFor="app_full_name">To'liq ism</Label>
                    <Input
                      id="app_full_name"
                      name="app_full_name"
                      required
                      maxLength={100}
                      defaultValue={profile?.full_name ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agency_name">Agentlik nomi</Label>
                    <Input id="agency_name" name="agency_name" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience_years">Tajriba (yil)</Label>
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
                  <Label htmlFor="message">Qo'shimcha ma'lumot</Label>
                  <Textarea id="message" name="message" rows={3} maxLength={1000} />
                </div>
                <Button type="submit" disabled={applyAgent.isPending}>
                  Ariza yuborish
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
