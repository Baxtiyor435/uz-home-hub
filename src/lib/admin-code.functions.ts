import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const verifyAdminCodeSchema = z.object({
  code: z.string().trim().min(1, "Kodni kiriting"),
});

/** Verifies the admin access code and grants the super_admin role to the caller. */
export const grantAdminWithCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyAdminCodeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const expectedCode = process.env["ADMIN_ACCESS_CODE"];
    if (!expectedCode) {
      throw new Error("Admin kirish kodi sozlanmagan");
    }
    if (data.code !== expectedCode) {
      throw new Error("Noto'g'ri kod");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Avoid duplicate role errors.
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!existingRole) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "super_admin" });
      if (error) throw new Error("Admin huquqi berilmadi");
    }

    await supabaseAdmin
      .from("profiles")
      .update({ is_verified_agent: true })
      .eq("id", context.userId);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin_access_granted",
      entity_type: "user",
      entity_id: context.userId,
      metadata: { via: "admin_access_code" },
    });

    return { ok: true };
  });
