import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffCheckClient = {
  rpc: (fn: "is_staff", args: { _user_id: string }) => PromiseLike<{ data: boolean | null }>;
};

async function assertStaff(supabase: StaffCheckClient, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (data !== true) throw new Error("Ruxsat yo'q");
}

const moderateListingSchema = z.object({
  propertyId: z.string().uuid(),
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

/** Approves or rejects a listing and notifies its owner. */
export const moderateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => moderateListingSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .update({
        status: data.approve ? "approved" : "rejected",
        reject_reason: data.approve ? null : (data.reason ?? "Sabab ko'rsatilmagan"),
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.propertyId)
      .select("owner_id, title")
      .single();
    if (error) throw new Error("E'lonni yangilab bo'lmadi");

    await supabaseAdmin.from("notifications").insert({
      user_id: property.owner_id,
      title: data.approve ? "E'loningiz tasdiqlandi" : "E'loningiz rad etildi",
      body: data.approve
        ? `"${property.title}" e'loni saytda chop etildi.`
        : `"${property.title}" e'loni rad etildi: ${data.reason ?? "sabab ko'rsatilmagan"}`,
      link: "/mening-elonlarim",
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.approve ? "listing_approved" : "listing_rejected",
      entity_type: "property",
      entity_id: data.propertyId,
      metadata: { reason: data.reason ?? null },
    });

    return { ok: true };
  });

const moderateApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

/** Approves or rejects an agent application and grants the agent role. */
export const moderateAgentApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => moderateApplicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: application, error } = await supabaseAdmin
      .from("agent_applications")
      .update({
        status: data.approve ? "approved" : "rejected",
        reject_reason: data.approve ? null : (data.reason ?? "Sabab ko'rsatilmagan"),
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId)
      .select("user_id, agency_name")
      .single();
    if (error) throw new Error("Arizani yangilab bo'lmadi");

    if (data.approve) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: application.user_id, role: "agent" }, { onConflict: "user_id,role" });
      await supabaseAdmin
        .from("profiles")
        .update({ is_verified_agent: true, agency_name: application.agency_name })
        .eq("id", application.user_id);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: application.user_id,
      title: data.approve ? "Agentlik arizangiz tasdiqlandi" : "Agentlik arizangiz rad etildi",
      body: data.approve
        ? "Endi siz sotuv e'lonlarini joylashtira olasiz."
        : `Sabab: ${data.reason ?? "ko'rsatilmagan"}`,
      link: "/profil",
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.approve ? "agent_approved" : "agent_rejected",
      entity_type: "agent_application",
      entity_id: data.applicationId,
      metadata: { reason: data.reason ?? null },
    });

    return { ok: true };
  });

const reviewPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

/** Lists premium payment requests waiting for staff confirmation. */
export const listPendingPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, amount, currency, months, payer_note, created_at")
      .eq("purpose", "premium")
      .eq("status", "pending")
      .eq("provider", "manual")
      .order("created_at", { ascending: true });
    if (error) throw new Error("To'lovlarni olib bo'lmadi");

    const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; phone: string | null }[] };

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((row) => ({
      ...row,
      full_name: byId.get(row.user_id)?.full_name ?? null,
      phone: byId.get(row.user_id)?.phone ?? null,
    }));
  });

/** Confirms or rejects a premium payment; confirming activates the subscription. */
export const reviewPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .update({
        status: data.approve ? "paid" : "canceled",
        reject_reason: data.approve ? null : (data.reason ?? "Sabab ko'rsatilmagan"),
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.paymentId)
      .eq("status", "pending")
      .select("user_id, months, amount")
      .single();
    if (error) throw new Error("To'lovni yangilab bo'lmadi");

    if (data.approve) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("premium_until")
        .eq("id", payment.user_id)
        .single();

      const current = profile?.premium_until ? new Date(profile.premium_until) : null;
      const base = current && current.getTime() > Date.now() ? current : new Date();
      const until = new Date(base);
      until.setMonth(until.getMonth() + (payment.months ?? 1));

      await supabaseAdmin
        .from("profiles")
        .update({ premium_until: until.toISOString() })
        .eq("id", payment.user_id);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: payment.user_id,
      title: data.approve ? "Premium obuna faollashdi" : "To'lov tasdiqlanmadi",
      body: data.approve
        ? `To'lovingiz tasdiqlandi. Premium obuna ${payment.months} oyga faollashtirildi.`
        : `Sabab: ${data.reason ?? "ko'rsatilmagan"}`,
      link: "/obuna",
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.approve ? "payment_approved" : "payment_rejected",
      entity_type: "payment",
      entity_id: data.paymentId,
      metadata: { reason: data.reason ?? null },
    });

    return { ok: true };
  });
