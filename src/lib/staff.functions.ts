import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Access codes are checked on the server only — never shipped to the browser. */
const ACCESS_CODES: Record<string, "admin" | "super_admin"> = {
  hello: "admin",
  hello_super: "super_admin",
};

const redeemSchema = z.object({ code: z.string().trim().min(1).max(64) });

/** Exchanges a staff access code for the matching role. */
export const redeemStaffCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => redeemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = ACCESS_CODES[data.code.toLowerCase()];
    if (!role) throw new Error("Kod noto'g'ri");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role }, { onConflict: "user_id,role" });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "staff_code_redeemed",
      entity_type: "user_role",
      metadata: { role },
    });

    return { role };
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error("Parolni o'zgartirib bo'lmadi");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "password_set",
      entity_type: "user",
      entity_id: data.userId,
      metadata: {},
    });
    return { ok: true };
  });
