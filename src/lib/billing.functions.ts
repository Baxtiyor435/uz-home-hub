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

/** Creates a pending premium payment request that an admin must confirm. */
export const createPremiumOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const plan = PREMIUM_PLANS.find((item) => item.id === data.planId)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("purpose", "premium")
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Sizda tekshiruv kutayotgan to'lov bor");

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
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error("Buyurtmani yaratib bo'lmadi");

    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      title: "To'lov so'rovi yuborildi",
      body: `${plan.label} obuna uchun to'lovingiz admin tekshiruviga yuborildi.`,
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
