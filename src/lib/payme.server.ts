/**
 * Payme Merchant API fulfillment helpers (server-only).
 * One successful payment activates either a premium subscription or a TOP promotion.
 */

type FulfillmentResult = { ok: true } | { ok: false; error: string };

async function notify(userId: string, title: string, body: string, link: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    link,
  });
}

/** Extends the payer's premium subscription by the purchased months. */
export async function fulfillPremiumPayment(paymentId: string): Promise<FulfillmentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, months, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "To'lov topilmadi" };
  if (payment.status === "paid") return { ok: true };

  await supabaseAdmin
    .from("payments")
    .update({ status: "paid", reviewed_at: new Date().toISOString(), provider: "payme" })
    .eq("id", paymentId);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("premium_until")
    .eq("id", payment.user_id)
    .maybeSingle();
  const current = profile?.premium_until ? new Date(profile.premium_until) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const until = new Date(base);
  until.setMonth(until.getMonth() + (payment.months || 1));
  await supabaseAdmin
    .from("profiles")
    .update({ premium_until: until.toISOString() })
    .eq("id", payment.user_id);

  await notify(
    payment.user_id,
    "Premium obuna faollashdi",
    `To'lovingiz Payme orqali qabul qilindi. Obuna ${payment.months || 1} oyga uzaytirildi.`,
    "/obuna",
  );
  return { ok: true };
}

/** Promotes the listing attached to the payment to the top for `months`-as-days period. */
export async function fulfillPromotionPayment(paymentId: string): Promise<FulfillmentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, months, property_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || !payment.property_id) return { ok: false, error: "To'lov topilmadi" };
  if (payment.status === "paid") return { ok: true };

  await supabaseAdmin
    .from("payments")
    .update({ status: "paid", reviewed_at: new Date().toISOString(), provider: "payme" })
    .eq("id", paymentId);

  const days = payment.months || 7;
  const { data: property } = await supabaseAdmin
    .from("properties")
    .select("id, promoted_until")
    .eq("id", payment.property_id)
    .maybeSingle();
  if (!property) return { ok: false, error: "E'lon topilmadi" };

  const current = property.promoted_until ? new Date(property.promoted_until) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const until = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await supabaseAdmin
    .from("properties")
    .update({ promoted_until: until.toISOString() })
    .eq("id", property.id);

  await notify(
    payment.user_id,
    "E'lon TOP ga chiqarildi",
    `Payme to'lovi qabul qilindi. E'loningiz ${days} kun ro'yxat boshida turadi.`,
    "/mening-elonlarim",
  );
  return { ok: true };
}

/** Routes fulfillment by payment purpose. */
export async function fulfillPayment(paymentId: string): Promise<FulfillmentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("purpose")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "To'lov topilmadi" };
  if (payment.purpose === "promotion") return fulfillPromotionPayment(paymentId);
  return fulfillPremiumPayment(paymentId);
}
