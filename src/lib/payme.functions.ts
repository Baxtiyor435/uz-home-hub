import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PREMIUM_PLANS } from "@/lib/billing.functions";
import { TOP_PLANS } from "@/lib/promotion";

/** Builds the hosted Payme checkout URL for a pending payment. */
function checkoutUrl(paymentId: string, amountUzs: number) {
  const merchantId = process.env["PAYME_MERCHANT_ID"]!;
  const params = `m=${merchantId};ac.order_id=${paymentId};a=${amountUzs * 100};c=${encodeURIComponent(
    "https://ubu.uz",
  )}`;
  const host = process.env["PAYME_CHECKOUT_HOST"] ?? "checkout.paycom.uz";
  return `https://${host}/${Buffer.from(params).toString("base64")}`;
}

const premiumSchema = z.object({ planId: z.enum(["monthly", "quarterly", "yearly"]) });

/** Creates a pending premium payment and returns the Payme checkout URL. */
export const startPaymePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => premiumSchema.parse(input))
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
        currency: "UZS",
        provider: "payme",
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error("To'lovni yaratib bo'lmadi");

    return { paymentId: payment.id, url: checkoutUrl(payment.id, plan.price) };
  });

const promotionSchema = z.object({
  propertyId: z.string().uuid(),
  planId: z.enum(["d3", "d7", "d30"]),
});

/** Creates a pending TOP promotion payment and returns the Payme checkout URL. */
export const startPaymePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => promotionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const plan = TOP_PLANS.find((item) => item.id === data.planId)!;

    const { data: property, error: readError } = await context.supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (readError || !property) throw new Error("E'lon topilmadi");
    if (property.owner_id !== context.userId) throw new Error("Ruxsat yo'q");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        purpose: "promotion",
        property_id: property.id,
        amount: plan.price,
        months: plan.days,
        currency: "UZS",
        provider: "payme",
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error("To'lovni yaratib bo'lmadi");

    return { paymentId: payment.id, url: checkoutUrl(payment.id, plan.price) };
  });

/** Lets the client poll whether a pending payment has been completed by Payme. */
export const checkPaymeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: payment } = await context.supabase
      .from("payments")
      .select("id, status")
      .eq("id", data.paymentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!payment) throw new Error("To'lov topilmadi");
    return { status: payment.status };
  });
