import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOP_PLANS } from "@/lib/promotion";

const inputSchema = z.object({
  propertyId: z.string().uuid(),
  planId: z.enum(["d3", "d7", "d30"]),
});

/** Promotes the caller's own listing to the top of the catalogue. */
export const promoteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const plan = TOP_PLANS.find((item) => item.id === data.planId)!;

    const { data: property, error: readError } = await context.supabase
      .from("properties")
      .select("id, owner_id, promoted_until")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (readError || !property) throw new Error("E'lon topilmadi");
    if (property.owner_id !== context.userId) throw new Error("Ruxsat yo'q");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      purpose: "promotion",
      property_id: property.id,
      amount: plan.price,
      currency: "UZS",
      provider: "manual",
      status: "paid",
      reviewed_at: new Date().toISOString(),
    });
    if (paymentError) throw new Error("To'lovni yaratib bo'lmadi");

    const current = property.promoted_until ? new Date(property.promoted_until) : null;
    const base = current && current.getTime() > Date.now() ? current : new Date();
    const until = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({ promoted_until: until.toISOString() })
      .eq("id", property.id);
    if (updateError) throw new Error("E'lonni yangilab bo'lmadi");

    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      title: "E'lon TOP ga chiqarildi",
      body: `E'loningiz ${plan.days} kun davomida ro'yxat boshida turadi.`,
      link: "/mening-elonlarim",
    });

    return { promotedUntil: until.toISOString(), price: plan.price, days: plan.days };
  });
