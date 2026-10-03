import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const redeemSchema = z.object({ code: z.string().trim().min(1).max(64) });

/** Staff access codes are disabled. Role changes happen only in the super admin panel. */
export const redeemStaffCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => redeemSchema.parse(input))
  .handler(async () => {
    throw new Error("Kirish kodi o'chirilgan");
  });

type RoleCheckClient = {
  rpc: (
    fn: "has_role",
    args: { _user_id: string; _role: "super_admin" },
  ) => PromiseLike<{ data: boolean | null }>;
};

async function assertSuperAdmin(supabase: RoleCheckClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (data !== true) throw new Error("Ruxsat yo'q");
}

/** Lists platform users with their roles (super admin only). */
export const listPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, is_blocked, is_verified_agent, premium_until, created_at, device_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Foydalanuvchilarni olib bo'lmadi");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    return (profiles ?? []).map((profile) => ({
      ...profile,
      roles: (roles ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role),
    }));
  });

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["agent", "admin", "super_admin"]),
  grant: z.boolean(),
});

/** Grants or revokes a role for a user (super admin only). */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.grant ? "role_granted" : "role_revoked",
      entity_type: "user_role",
      entity_id: data.userId,
      metadata: { role: data.role },
    });

    return { ok: true };
  });

const primaryRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "agent", "admin", "super_admin"]),
});

/** Sets exactly one role for a user in a single action (super admin only). */
export const setUserPrimaryRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => primaryRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "super_admin") {
      throw new Error("O'zingizni pasaytira olmaysiz");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["agent", "admin", "super_admin"]);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: "user" }, { onConflict: "user_id,role" });
    if (data.role !== "user") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    }
    await supabaseAdmin
      .from("profiles")
      .update({ is_verified_agent: data.role === "agent" })
      .eq("id", data.userId);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "role_set",
      entity_type: "user_role",
      entity_id: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

const blockSchema = z.object({ userId: z.string().uuid(), blocked: z.boolean() });

/** Blocks or unblocks a user (super admin only). */
export const setUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => blockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_blocked: data.blocked }).eq("id", data.userId);
    return { ok: true };
  });

const deviceResetSchema = z.object({ userId: z.string().uuid() });

/** Clears the device binding so the user can sign in from a new device (super admin only). */
export const resetUserDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deviceResetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ device_id: null, device_bound_at: null })
      .eq("id", data.userId);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "device_reset",
      entity_type: "profile",
      entity_id: data.userId,
    });

    return { ok: true };
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

/** Permanently deletes a user account and all their data (super admin only, not self). */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("O'zingizni o'chira olmaysiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user_deleted",
      entity_type: "user",
      entity_id: data.userId,
      metadata: {},
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Foydalanuvchini o'chirib bo'lmadi");
    return { ok: true };
  });

/** Lists every listing on the platform (super admin only). */
export const listAllProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, title, price, currency, deal_type, region, district, status, created_at, owner_id")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("E'lonlarni olib bo'lmadi");
    return data ?? [];
  });

const deletePropertySchema = z.object({ propertyId: z.string().uuid() });

/** Permanently deletes any listing (super admin only). */
export const deleteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deletePropertySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("owner_id, title")
      .eq("id", data.propertyId)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("properties").delete().eq("id", data.propertyId);
    if (error) throw new Error("E'lonni o'chirib bo'lmadi");

    if (property) {
      await supabaseAdmin.from("notifications").insert({
        user_id: property.owner_id,
        title: "E'loningiz o'chirildi",
        body: `"${property.title}" e'loni administrator tomonidan o'chirildi.`,
        link: "/mening-elonlarim",
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "property_deleted",
      entity_type: "property",
      entity_id: data.propertyId,
      metadata: { title: property?.title ?? null },
    });

    return { ok: true };
  });

const passwordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6).max(72),
});

/** Sets a new password for any user, including self (super admin only). */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => passwordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { passwordStamp } = await import("@/lib/password-stamp");
    const { data: current, error: readError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (readError || !current.user) throw new Error("Parolni o'zgartirib bo'lmadi");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      app_metadata: {
        ...(current.user.app_metadata ?? {}),
        password_sha256: passwordStamp(data.password),
      },
    });
    if (error) throw new Error("Parolni o'zgartirib bo'lmadi");

    // Eski sessiyalar yangi paroldan keyin yopiladi.
    await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "password_set",
      entity_type: "user",
      entity_id: data.userId,
      metadata: {},
    });
    return { ok: true };
  });
