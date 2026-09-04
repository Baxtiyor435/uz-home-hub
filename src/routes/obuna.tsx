import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  PAYMENT_CARD,
  PREMIUM_PLANS,
  createPremiumOrder,
  listMyPremiumOrders,
} from "@/lib/billing.functions";
import { openPaymeCheckout } from "@/lib/payme-redirect";
import { startPaymePremium } from "@/lib/payme.functions";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/obuna")({
  head: () => ({
    meta: [
      { title: "Premium obuna — UBU Real Estate" },
      {
        name: "description",
        content:
          "UBU Real Estate Premium obunasi: cheksiz kontaktlar, e'lonlar yuqorida va tasdiqlangan agent belgisi.",
      },
      { property: "og:title", content: "Premium obuna — UBU Real Estate" },
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

const BENEFITS = [
  "Barcha e'lon egalarining kontaktlari cheksiz ochiq",
  "E'lonlaringiz qidiruvda yuqorida ko'rsatiladi",
  "Profilda Premium belgisi",
  "Statistika: ko'rishlar va murojaatlar",
  "Ustuvor qo'llab-quvvatlash",
];

function SubscriptionPage() {
  const { user, isPremium, profile, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: orders } = useQuery({
    queryKey: ["premium-orders", user?.id],
    enabled: !!user,
    queryFn: () => listMyPremiumOrders({ data: undefined }),
  });

  const hasPending = (orders ?? []).some((row) => row.status === "pending");

  const order = useMutation({
    mutationFn: (planId: "monthly" | "quarterly" | "yearly") =>
      createPremiumOrder({ data: { planId, note: note.trim() || undefined } }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["premium-orders", user?.id] });
      refresh();
      toast.success("Obunangiz faollashtirildi!");
    },
    onError: (error: Error) => toast.error(error.message || "Buyurtmani yaratib bo'lmadi"),
  });

  const payme = useMutation({
    mutationFn: (planId: "monthly" | "quarterly" | "yearly") =>
      startPaymePremium({ data: { planId } }),
    onSuccess: ({ url }) => {
      toast.success("Payme to'lov sahifasi ochilmoqda...");
      openPaymeCheckout(url);
    },
    onError: (error: Error) => toast.error(error.message || "Payme to'lovini boshlab bo'lmadi"),
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="text-center">
          <Crown className="text-primary mx-auto h-8 w-8" aria-hidden="true" />
          <h1 className="font-display mt-3 text-3xl font-bold">Premium obuna</h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            Ko'proq mijoz, tezroq bitim. Premium bilan kontaktlar cheksiz ochiladi va e'lonlaringiz
            yuqorida turadi.
          </p>
          {isPremium && profile?.premium_until && (
            <Badge className="mt-4">Faol · {formatDate(profile.premium_until)} gacha</Badge>
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

        <section className="surface-card mt-6 p-6">
          <h2 className="font-display text-lg font-semibold">To'lov tartibi</h2>
          <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>
              Quyidagi kartaga tarif summasini o'tkazing:{" "}
              <span className="text-foreground font-semibold">{PAYMENT_CARD.number}</span> (
              {PAYMENT_CARD.holder})
            </li>
            <li>To'lov chek raqami yoki to'lagan karta raqamingizni izohga yozing.</li>
            <li>Tarifni tanlab "Obunani faollashtirish" tugmasini bosing.</li>
            <li>Obunangiz darhol faollashadi.</li>
          </ol>
          {user && (
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Chek raqami / to'lagan karta (ixtiyoriy)"
              className="mt-4"
              maxLength={300}
            />
          )}
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PREMIUM_PLANS.map((plan) => (
            <article key={plan.id} className="surface-card flex flex-col p-6 text-center">
              <h2 className="font-display text-lg font-semibold">{plan.label}</h2>
              <p className="text-primary mt-2 text-xl font-bold">{formatPrice(plan.price, "UZS")}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {plan.months} oy · oyiga {formatPrice(Math.round(plan.price / plan.months), "UZS")}
              </p>
              <div className="mt-auto space-y-2 pt-5">
                {user ? (
                  <>
                    <Button
                      className="w-full"
                      disabled={payme.isPending}
                      onClick={() => payme.mutate(plan.id)}
                    >
                      {payme.isPending ? "Yuklanmoqda..." : "Payme orqali to'lash"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={order.isPending || hasPending}
                      onClick={() => order.mutate(plan.id)}
                    >
                      {hasPending ? "Tekshiruvda" : "Karta o'tkazmasi bilan"}
                    </Button>
                  </>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/auth">Kirish</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>

        {hasPending && (
          <p className="text-muted-foreground mt-6 text-center text-xs">
            To'lovingiz admin tekshiruvida. Tasdiqlangach bildirishnoma keladi va obuna faollashadi.
          </p>
        )}

        {(orders?.length ?? 0) > 0 && (
          <section className="mt-10">
            <h2 className="font-display mb-3 text-lg font-semibold">Buyurtmalarim</h2>
            <div className="space-y-2">
              {orders!.map((row) => (
                <div key={row.id} className="surface-card p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {formatPrice(row.amount, row.currency)} · {row.months} oy
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(row.created_at)}
                    </span>
                    <Badge variant="secondary">
                      {row.status === "paid"
                        ? "Tasdiqlangan"
                        : row.status === "pending"
                          ? "Tekshiruvda"
                          : "Rad etilgan"}
                    </Badge>
                  </div>
                  {row.reject_reason && (
                    <p className="text-muted-foreground mt-2 text-xs">Sabab: {row.reject_reason}</p>
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
