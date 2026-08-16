import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { normalizePhone } from "@/lib/format";

const signInSchema = z.object({
  phone: z.string().min(9, "Telefon raqamini kiriting"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak").max(72),
  deviceId: z.string().trim().min(6).max(100),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().max(100).optional(),
});

export type AuthResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; message: string };

const DEVICE_MISMATCH_MESSAGE =
  "Bu hisob boshqa qurilmaga bog'langan. Bitta hisob faqat bitta qurilmada ishlaydi. Administratorga murojaat qiling.";


/** Ro'yxatdan o'tish: telefon raqam + parol bilan yangi hisob yaratadi. */
export const signUpWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signUpSchema.parse(input))
  .handler(async ({ data }): Promise<AuthResult> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, message: "Telefon raqami noto'g'ri kiritilgan" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phoneToEmail } = await import("@/lib/otp.server");
    const { createAuthClient } = await import("@/lib/session.server");

    const email = phoneToEmail(phone);

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_blocked")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      return { ok: false, message: "Bu raqam allaqachon ro'yxatdan o'tgan. Kirish bo'limidan foydalaning" };
    }

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { phone, full_name: data.fullName ?? "" },
    });
    if (createError) {
      console.error("User creation failed", createError);
      return { ok: false, message: "Hisob yaratishda xatolik yuz berdi" };
    }

    const authClient = createAuthClient();
    if (!authClient) return { ok: false, message: "Server sozlamalarida xatolik" };

    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (signInError || !signIn.session) {
      console.error("Sign-in after sign-up failed", signInError);
      return { ok: false, message: "Tizimga kirishda xatolik yuz berdi" };
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        ...(data.fullName ? { full_name: data.fullName, phone } : {}),
        device_id: data.deviceId,
        device_bound_at: new Date().toISOString(),
      })
      .eq("id", signIn.session.user.id);


    return {
      ok: true,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });

/** Kirish: telefon raqam + parol. */
export const signInWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signInSchema.parse(input))
  .handler(async ({ data }): Promise<AuthResult> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, message: "Telefon raqami noto'g'ri kiritilgan" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { phoneToEmail } = await import("@/lib/otp.server");
    const { createAuthClient } = await import("@/lib/session.server");

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_blocked, device_id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile?.is_blocked) {
      return { ok: false, message: "Hisobingiz bloklangan. Administratorga murojaat qiling" };
    }

    if (existingProfile?.device_id && existingProfile.device_id !== data.deviceId) {
      return { ok: false, message: DEVICE_MISMATCH_MESSAGE };
    }

    const authClient = createAuthClient();
    if (!authClient) return { ok: false, message: "Server sozlamalarida xatolik" };

    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password: data.password,
    });
    if (signInError || !signIn.session) {
      return { ok: false, message: "Telefon raqam yoki parol noto'g'ri" };
    }

    if (!existingProfile?.device_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ device_id: data.deviceId, device_bound_at: new Date().toISOString() })
        .eq("id", signIn.session.user.id);
    }

    return {
      ok: true,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };

  });
