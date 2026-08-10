import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PREMIUM_PRICE } from "@/lib/uz";

export const PREMIUM_PLANS = [
  { id: "monthly", months: 1, label: "1 oylik", price: DEFAULT_PREMIUM_PRICE },
  { id: "quarterly", months: 3, label: "3 oylik", price: DEFAULT_PREMIUM_PRICE * 3 - 5000 },
  { id: "yearly", months: 12, label: "1 yillik", price: DEFAULT_PREMIUM_PRICE * 12 - 30000 },
] as const;

/** Card the user transfers the payment to before admin confirmation. */
export const PAYMENT_CARD = {
  number: "8600 1234 5678 9012",
  holder: "UBU REAL ESTATE",
};

const planSchema = z.object({
  planId: z.enum(["monthly", "quarterly", "yearly"]),
  note: z.string().trim().max(300).optional(),
});

/** Creates a premium order and activates the subscription immediately. */
export const createPremiumOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const plan = PREMIUM_PLANS.find((item) => item.id === data.planId)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        purpose: "premium",
        amount: plan.price,
        months: plan.months,
        payer_note: data.note ?? null,
        currency: "UZS",
        provider: "manual",
        status: "paid",
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error("Buyurtmani yaratib bo'lmadi");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("premium_until")
      .eq("id", context.userId)
      .single();
    const current = profile?.premium_until ? new Date(profile.premium_until) : null;
    const base = current && current.getTime() > Date.now() ? current : new Date();
    const until = new Date(base);
    until.setMonth(until.getMonth() + plan.months);
    await supabaseAdmin
      .from("profiles")
      .update({ premium_until: until.toISOString() })
      .eq("id", context.userId);

    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      title: "Premium obuna faollashdi",
      body: `${plan.label} obuna darhol faollashtirildi.`,
      link: "/obuna",
    });

    return { paymentId: payment.id, amount: plan.price, months: plan.months };
  });

/** Returns the signed-in user's premium orders. */
export const listMyPremiumOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payments")
      .select("id, amount, currency, status, months, payer_note, reject_reason, created_at")
      .eq("purpose", "premium")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error("To'lovlarni olib bo'lmadi");
    return data ?? [];
  });
