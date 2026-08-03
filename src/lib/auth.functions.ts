import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { normalizePhone } from "@/lib/format";

const phoneSchema = z.object({
  phone: z.string().min(9, "Telefon raqamini kiriting"),
  fullName: z.string().trim().max(100).optional(),
});

const verifySchema = z.object({
  phone: z.string().min(9),
  code: z.string().regex(/^\d{6}$/, "Kod 6 ta raqamdan iborat bo'lishi kerak"),
  fullName: z.string().trim().max(100).optional(),
});

export type SendOtpResult = { ok: true; resendAfter: number } | { ok: false; message: string };
export type VerifyOtpResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; message: string };

/** Step 1 — generate a code and deliver it over SMS. */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => phoneSchema.parse(input))
  .handler(async ({ data }): Promise<SendOtpResult> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, message: "Telefon raqami noto'g'ri kiritilgan" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOtpCode, hashOtpCode, sendSms, otpConfig, DEMO_OTP_CODE } = await import(
      "@/lib/otp.server"
    );

    // Demo rejimi: SMS o'rniga doimiy kod bilan kirish.
    if (DEMO_OTP_CODE) {
      return { ok: true, resendAfter: 0 };
    }


    const { data: recent } = await supabaseAdmin
      .from("otp_codes")
      .select("created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (elapsed < otpConfig.resendSeconds) {
        return {
          ok: false,
          message: `Yangi kod so'rash uchun ${Math.ceil(otpConfig.resendSeconds - elapsed)} soniya kuting`,
        };
      }
    }

    const code = generateOtpCode();
    const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "ubu";
    const codeHash = await hashOtpCode(phone, code, pepper);
    const expiresAt = new Date(Date.now() + otpConfig.ttlMinutes * 60_000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone, code_hash: codeHash, expires_at: expiresAt });
    if (insertError) {
      console.error("OTP insert failed", insertError);
      return { ok: false, message: "Kodni yaratishda xatolik yuz berdi. Qayta urinib ko'ring" };
    }

    try {
      await sendSms(phone, `UBU Real Estate: tasdiqlash kodingiz ${code}. Kod ${otpConfig.ttlMinutes} daqiqa amal qiladi.`);
    } catch (error) {
      console.error("SMS delivery failed", error);
      if (error instanceof Error && error.message === "SMS_NOT_CONFIGURED") {
        return { ok: false, message: "SMS xizmati hali sozlanmagan. Administratorga murojaat qiling" };
      }
      return { ok: false, message: "SMS yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring" };
    }

    return { ok: true, resendAfter: otpConfig.resendSeconds };
  });

/** Step 2 — verify the code, create the account when needed and return a session. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }): Promise<VerifyOtpResult> => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, message: "Telefon raqami noto'g'ri kiritilgan" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOtpCode, generateStrongPassword, phoneToEmail, otpConfig, DEMO_OTP_CODE } =
      await import("@/lib/otp.server");
    const { createClient } = await import("@supabase/supabase-js");

    const isDemoCode = data.code === DEMO_OTP_CODE;

    if (!isDemoCode) {
      const { data: record } = await supabaseAdmin
        .from("otp_codes")
        .select("id, code_hash, attempts, consumed_at, expires_at")
        .eq("phone", phone)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record) return { ok: false, message: "Kod topilmadi. Yangi kod so'rang" };
      if (new Date(record.expires_at).getTime() < Date.now()) {
        return { ok: false, message: "Kod muddati tugagan. Yangi kod so'rang" };
      }
      if (record.attempts >= otpConfig.maxAttempts) {
        return { ok: false, message: "Urinishlar soni tugadi. Yangi kod so'rang" };
      }

      const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "ubu";
      const codeHash = await hashOtpCode(phone, data.code, pepper);
      if (codeHash !== record.code_hash) {
        await supabaseAdmin
          .from("otp_codes")
          .update({ attempts: record.attempts + 1 })
          .eq("id", record.id);
        return { ok: false, message: "Kod noto'g'ri. Qaytadan kiriting" };
      }

      await supabaseAdmin
        .from("otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", record.id);
    }


    const email = phoneToEmail(phone);
    const password = generateStrongPassword();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_blocked")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile?.is_blocked) {
      return { ok: false, message: "Hisobingiz bloklangan. Administratorga murojaat qiling" };
    }

    if (existingProfile) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, { password });
      if (error) {
        console.error("Password rotation failed", error);
        return { ok: false, message: "Tizimga kirishda xatolik yuz berdi" };
      }
    } else {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { phone, full_name: data.fullName ?? "" },
      });
      if (error) {
        console.error("User creation failed", error);
        return { ok: false, message: "Hisob yaratishda xatolik yuz berdi" };
      }
    }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) {
      return { ok: false, message: "Server sozlamalarida xatolik" };
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (publishableKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishableKey}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signIn.session) {
      console.error("Sign-in failed", signInError);
      return { ok: false, message: "Tizimga kirishda xatolik yuz berdi" };
    }

    if (data.fullName) {
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName, phone })
        .eq("id", signIn.session.user.id);
    }

    return {
      ok: true,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });
