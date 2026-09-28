import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PREMIUM_PLANS, listMyPremiumOrders } from "@/lib/billing.functions";
import { openPaymeCheckout } from "@/lib/payme-redirect";
import { startPaymePremium } from "@/lib/payme.functions";
import { formatDate, formatPrice } from "@/lib/format";
import { useTr } from "@/lib/i18n";

export const Route = createFileRoute("/obuna")({
  head: () => ({
    meta: [
      { title: "Premium obuna — UBU" },
      {
        name: "description",
        content:
          "UBU Premium obunasi: cheksiz kontaktlar, e'lonlar yuqorida va tasdiqlangan agent belgisi.",
      },
      { property: "og:title", content: "Premium obuna — UBU" },
      {
        property: "og:description",
        content: "Premium obuna bilan e'lonlaringiz yuqorida turadi va kontaktlar cheksiz ochiladi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscriptionPage,
});

function getBenefits(tr: (uz: string, ru: string) => string) {
  return [
    tr("Barcha e'lon egalarining kontaktlari cheksiz ochiq", "Неограниченный доступ к контактам всех владельцев объявлений"),
    tr("E'lonlaringiz qidiruvda yuqorida ko'rsatiladi", "Ваши объявления показываются выше в поиске"),
    tr("Profilda Premium belgisi", "Значок Premium в профиле"),
    tr("Statistika: ko'rishlar va murojaatlar", "Статистика: просмотры и обращения"),
    tr("Ustuvor qo'llab-quvvatlash", "Приоритетная поддержка"),
  ];
}

function SubscriptionPage() {
  const { user, isPremium, profile } = useAuth();
  const tr = useTr();
  const BENEFITS = getBenefits(tr);

  const { data: orders } = useQuery({
    queryKey: ["premium-orders", user?.id],
    enabled: !!user,
    queryFn: () => listMyPremiumOrders({ data: undefined }),
  });



  const payme = useMutation({
    mutationFn: (planId: "monthly" | "quarterly" | "yearly") =>
      startPaymePremium({ data: { planId } }),
    onSuccess: ({ url }) => {
      toast.success(tr("Payme to'lov sahifasi ochilmoqda...", "Открывается страница оплаты Payme..."));
      openPaymeCheckout(url);
    },
    onError: (error: Error) => toast.error(error.message || tr("Payme to'lovini boshlab bo'lmadi", "Не удалось начать оплату Payme")),
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="text-center">
          <Crown className="text-primary mx-auto h-8 w-8" aria-hidden="true" />
          <h1 className="font-display mt-3 text-3xl font-bold">{tr("Premium obuna", "Premium подписка")}</h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            {tr(
              "Ko'proq mijoz, tezroq bitim. Premium bilan kontaktlar cheksiz ochiladi va e'lonlaringiz yuqorida turadi.",
              "Больше клиентов, быстрее сделки. С Premium контакты открыты без ограничений, а ваши объявления показываются выше.",
            )}
          </p>
          {isPremium && profile?.premium_until && (
            <Badge className="mt-4">{tr("Faol", "Активна")} · {tr("gacha", "до")} {formatDate(profile.premium_until)}</Badge>
          )}
        </header>

        <ul className="surface-card mt-8 grid gap-3 p-6 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>


        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PREMIUM_PLANS.map((plan) => (
            <article key={plan.id} className="surface-card flex flex-col p-6 text-center">
              <h2 className="font-display text-lg font-semibold">
                {plan.id === "monthly"
                  ? tr("1 oylik", "1 месяц")
                  : plan.id === "quarterly"
                    ? tr("3 oylik", "3 месяца")
                    : tr("1 yillik", "1 год")}
              </h2>
              <p className="text-primary mt-2 text-xl font-bold">{formatPrice(plan.price, "UZS")}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {plan.months} {tr("oy", "мес.")} · {tr("oyiga", "в месяц")} {formatPrice(Math.round(plan.price / plan.months), "UZS")}
              </p>
              <div className="mt-auto space-y-2 pt-5">
                {user ? (
                  <Button
                    className="w-full"
                    disabled={payme.isPending}
                    onClick={() => payme.mutate(plan.id)}
                  >
                    {payme.isPending ? tr("Yuklanmoqda...", "Загрузка...") : tr("Payme orqali to'lash", "Оплатить через Payme")}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/auth">{tr("Kirish", "Войти")}</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>


        {(orders?.length ?? 0) > 0 && (
          <section className="mt-10">
            <h2 className="font-display mb-3 text-lg font-semibold">{tr("Buyurtmalarim", "Мои заказы")}</h2>
            <div className="space-y-2">
              {orders!.map((row) => (
                <div key={row.id} className="surface-card p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {formatPrice(row.amount, row.currency)} · {row.months} {tr("oy", "мес.")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(row.created_at)}
                    </span>
                    <Badge variant="secondary">
                      {row.status === "paid"
                        ? tr("Tasdiqlangan", "Подтверждён")
                        : row.status === "pending"
                          ? tr("Tekshiruvda", "На проверке")
                          : tr("Rad etilgan", "Отклонён")}
                    </Badge>
                  </div>
                  {row.reject_reason && (
                    <p className="text-muted-foreground mt-2 text-xs">{tr("Sabab", "Причина")}: {row.reject_reason}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </PageShell>
  );
}
