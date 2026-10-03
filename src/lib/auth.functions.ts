import { randomBytes } from "crypto";

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
  | { ok: false; mfaRequired: true; challengeId: string; challengeToken: string }
  | { ok: false; mfaRequired?: false; message: string };

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
    const mfa = await import("@/lib/mfa.server");

    // Brute-force himoyasi: bitta raqam bo'yicha 15 daqiqada 8 ta urinish.
    const bucket = `phone:${phone}`;
    const limit = await mfa.checkRateLimit(supabaseAdmin, bucket, "login", 8, 900);
    if (!limit.allowed) {
      return {
        ok: false,
        message: `Juda ko'p urinish. ${Math.ceil(limit.retryAfterSeconds / 60)} daqiqadan so'ng qayta urining`,
      };
    }
    await mfa.recordAttempt(supabaseAdmin, bucket, "login");

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

    // Parol o'zgargandan keyin faqat oxirgi parol ishlashi kerak.
    // Supabase ba'zan eski parolni ham qabul qiladi, shuning uchun belgi tekshiriladi.
    const { passwordStamp } = await import("@/lib/password-stamp");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(signIn.session.user.id);
    const stamp = authUser.user?.app_metadata?.password_sha256;
    if (typeof stamp === "string" && stamp.length > 0 && stamp !== passwordStamp(data.password)) {
      return { ok: false, message: "Telefon raqam yoki parol noto'g'ri" };
    }

    if (!existingProfile?.device_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ device_id: data.deviceId, device_bound_at: new Date().toISOString() })
        .eq("id", signIn.session.user.id);
    }

    // 2FA yoqilgan bo'lsa — sessiya hali berilmaydi, faqat challenge qaytariladi.
    const { data: mfaRow } = await supabaseAdmin
      .from("user_mfa")
      .select("enabled")
      .eq("user_id", signIn.session.user.id)
      .maybeSingle();

    if (mfaRow?.enabled) {
      const challengeToken = randomBytes(32).toString("hex");
      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from("mfa_challenges")
        .insert({
          user_id: signIn.session.user.id,
          token_hash: mfa.hashToken(challengeToken),
          session_cipher: mfa.encryptSecret(
            JSON.stringify({
              access_token: signIn.session.access_token,
              refresh_token: signIn.session.refresh_token,
            }),
          ),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (challengeError || !challenge) {
        return { ok: false, message: "Tizimga kirishda xatolik yuz berdi" };
      }

      return { ok: false, mfaRequired: true, challengeId: challenge.id, challengeToken };
    }

    await mfa.clearAttempts(supabaseAdmin, bucket, "login");

    return {
      ok: true,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });
