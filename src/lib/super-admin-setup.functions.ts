import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone } from "@/lib/format";

const READY_KEY = "super_admin_owner_ready";

const setupSchema = z.object({
  phone: z.string().min(9),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(6).max(72),
  deviceId: z.string().trim().min(6).max(100),
});

async function isOwnerReady(supabaseAdmin: {
  from: (table: "platform_settings") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: { value: { ready?: boolean } | null } | null }>;
      };
    };
  };
}) {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", READY_KEY).maybeSingle();
  return data?.value?.ready === true;
}

/** Says whether the owner still needs to create the first super admin password. */
export const getSuperAdminSetupState = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { needsSetup: !(await isOwnerReady(supabaseAdmin)) };
});

/** Creates the owner super admin account once, then locks setup. */
export const createSuperAdminOwner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => setupSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Telefon raqami noto'g'ri");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phoneToEmail } = await import("@/lib/otp.server");
    const { passwordStamp } = await import("@/lib/password-stamp");

    if (await isOwnerReady(supabaseAdmin)) {
      throw new Error("Parol allaqachon yaratilgan. Kirish bo'limidan foydalaning");
    }

    const email = phoneToEmail(phone);
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).maybeSingle();

    let userId = profile?.id ?? null;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { phone, full_name: data.fullName },
        app_metadata: { password_sha256: passwordStamp(data.password) },
      });
      if (error || !created.user) throw new Error("Hisob yaratib bo'lmadi");
      userId = created.user.id;
    } else {
      const { data: current, error: readError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (readError || !current.user) throw new Error("Hisobni yangilab bo'lmadi");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email,
        email_confirm: true,
        user_metadata: { ...(current.user.user_metadata ?? {}), phone, full_name: data.fullName },
        app_metadata: { ...(current.user.app_metadata ?? {}), password_sha256: passwordStamp(data.password) },
      });
      if (error) throw new Error("Parolni saqlab bo'lmadi");
    }

    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      phone,
      device_id: data.deviceId,
      device_bound_at: new Date().toISOString(),
    }).eq("id", userId);

    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("platform_settings").upsert({
      key: READY_KEY,
      value: { ready: true },
      updated_at: new Date().toISOString(),
    });

    return { ok: true };
  });

const changeSchema = z.object({
  currentPassword: z.string().min(6).max(72),
  newPassword: z.string().min(6).max(72),
});

/** Owner changes the super admin password from settings. */
export const changeSuperAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => changeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (isSuper !== true) throw new Error("Ruxsat yo'q");
    if (data.currentPassword === data.newPassword) throw new Error("Yangi parol eskisidan farq qilishi kerak");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phoneToEmail } = await import("@/lib/otp.server");
    const { passwordStamp } = await import("@/lib/password-stamp");
    const { createAuthClient } = await import("@/lib/session.server");

    const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", context.userId).maybeSingle();
    if (!profile?.phone) throw new Error("Telefon raqam topilmadi");

    const authClient = createAuthClient();
    if (!authClient) throw new Error("Server sozlamalarida xatolik");
    const { error: currentError } = await authClient.auth.signInWithPassword({
      email: phoneToEmail(profile.phone),
      password: data.currentPassword,
    });
    if (currentError) throw new Error("Joriy parol noto'g'ri");

    const { data: current, error: readError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (readError || !current.user) throw new Error("Parolni o'zgartirib bo'lmadi");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
      app_metadata: { ...(current.user.app_metadata ?? {}), password_sha256: passwordStamp(data.newPassword) },
    });
    if (error) throw new Error("Parolni o'zgartirib bo'lmadi");
    await supabaseAdmin.auth.admin.signOut(context.userId, "global");
    return { ok: true };
  });


const resetSchema = z.object({ confirm: z.literal("NOLGA") });

/** Deletes listings, app data, and auth users. Owner must type NOLGA. */
export const resetPlatformToZero = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = [
      "messages",
      "conversations",
      "bookings",
      "reviews",
      "favorites",
      "property_unlocks",
      "payments",
      "notifications",
      "agent_applications",
      "properties",
      "audit_logs",
      "otp_codes",
      "user_roles",
      "profiles",
    ];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().not("id", "is", null);
      if (error) {
        const retry = await supabaseAdmin.from(table).delete().not("user_id", "is", null);
        if (retry.error) throw new Error(`${table} tozalanmadi`);
      }
    }
    await supabaseAdmin.from("platform_settings").delete().eq("key", READY_KEY);

    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error("Foydalanuvchilarni o'chirib bo'lmadi");
      const users = data.users ?? [];
      if (users.length === 0) break;
      for (const user of users) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
      if (users.length < 200) break;
      page += 1;
    }
    return { ok: true };
  });
