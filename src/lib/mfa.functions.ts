import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "6 xonali kodni kiriting");

const passwordSchema = z.string().min(6).max(72);

export type MfaStatus = { enabled: boolean; backupCodesLeft: number };

export type SetupStart =
  | { ok: true; otpauthUri: string; manualKey: string; qrDataUrl: string }
  | { ok: false; message: string };

export type SetupConfirm = { ok: true; backupCodes: string[] } | { ok: false; message: string };

export type MfaVerifyResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; message: string };

const GENERIC_ERROR = "Parol yoki kod noto'g'ri";

/** Joriy foydalanuvchining 2FA holati. Maxfiy kalit hech qachon qaytarilmaydi. */
export const getMfaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MfaStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_mfa")
      .select("enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.enabled) return { enabled: false, backupCodesLeft: 0 };
    const { count } = await supabaseAdmin
      .from("mfa_backup_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("used_at", null);
    return { enabled: true, backupCodesLeft: count ?? 0 };
  });

/** 1-qadam: parolni tasdiqlash va yangi TOTP kalit + QR kod yaratish. */
export const startMfaSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ password: passwordSchema }).parse(input))
  .handler(async ({ data, context }): Promise<SetupStart> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mfa = await import("@/lib/mfa.server");
    const { createAuthClient } = await import("@/lib/session.server");
    const QRCode = (await import("qrcode")).default;

    const limit = await mfa.checkRateLimit(supabaseAdmin, `user:${context.userId}`, "mfa_setup", 8, 600);
    if (!limit.allowed) return { ok: false, message: "Juda ko'p urinish. Birozdan so'ng qayta urining" };
    await mfa.recordAttempt(supabaseAdmin, `user:${context.userId}`, "mfa_setup");

    const { data: existing } = await supabaseAdmin
      .from("user_mfa")
      .select("enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.enabled) return { ok: false, message: "2FA allaqachon yoqilgan" };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRes?.user?.email;
    if (!email) return { ok: false, message: GENERIC_ERROR };

    const authClient = createAuthClient();
    if (!authClient) return { ok: false, message: "Server sozlamalarida xatolik" };
    const { error: pwError } = await authClient.auth.signInWithPassword({ email, password: data.password });
    if (pwError) return { ok: false, message: GENERIC_ERROR };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    const label = profile?.phone ? `+${profile.phone.replace(/\D/g, "")}` : email;

    const secret = mfa.generateTotpSecret();
    const otpauthUri = mfa.buildOtpauthUri(secret, label);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 260 });

    await supabaseAdmin.from("user_mfa").upsert({
      user_id: context.userId,
      secret_cipher: mfa.encryptSecret(secret),
      enabled: false,
      last_used_counter: null,
      confirmed_at: null,
    });

    return { ok: true, otpauthUri, manualKey: secret, qrDataUrl };
  });

/** 2-qadam: authenticator kodini tekshirish va 2FA ni yoqish. */
export const confirmMfaSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: codeSchema }).parse(input))
  .handler(async ({ data, context }): Promise<SetupConfirm> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mfa = await import("@/lib/mfa.server");

    const bucket = `user:${context.userId}`;
    const limit = await mfa.checkRateLimit(supabaseAdmin, bucket, "mfa_confirm", 8, 600);
    if (!limit.allowed) return { ok: false, message: "Juda ko'p urinish. Birozdan so'ng qayta urining" };
    await mfa.recordAttempt(supabaseAdmin, bucket, "mfa_confirm");

    const { data: row } = await supabaseAdmin
      .from("user_mfa")
      .select("secret_cipher, enabled, last_used_counter")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row || row.enabled) return { ok: false, message: "Avval sozlashni boshlang" };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    const label = profile?.phone ? `+${profile.phone.replace(/\D/g, "")}` : (userRes?.user?.email ?? "user");

    const check = mfa.verifyTotp(mfa.decryptSecret(row.secret_cipher), label, data.code, null);
    if (!check.valid) return { ok: false, message: "Kod noto'g'ri. Qayta urinib ko'ring" };

    const codes = mfa.generateBackupCodes(10);
    await supabaseAdmin.from("mfa_backup_codes").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("mfa_backup_codes").insert(
      codes.map((code) => ({ user_id: context.userId, code_hash: mfa.hashBackupCode(code) })),
    );
    await supabaseAdmin
      .from("user_mfa")
      .update({ enabled: true, confirmed_at: new Date().toISOString(), last_used_counter: check.counter })
      .eq("user_id", context.userId);
    await mfa.clearAttempts(supabaseAdmin, bucket, "mfa_confirm");

    return { ok: true, backupCodes: codes };
  });

/** 2FA ni o'chirish: parol + joriy TOTP kod talab qilinadi. */
export const disableMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ password: passwordSchema, code: codeSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mfa = await import("@/lib/mfa.server");
    const { createAuthClient } = await import("@/lib/session.server");

    const bucket = `user:${context.userId}`;
    const limit = await mfa.checkRateLimit(supabaseAdmin, bucket, "mfa_disable", 5, 900);
    if (!limit.allowed) return { ok: false, message: "Juda ko'p urinish. Birozdan so'ng qayta urining" };
    await mfa.recordAttempt(supabaseAdmin, bucket, "mfa_disable");

    const { data: row } = await supabaseAdmin
      .from("user_mfa")
      .select("secret_cipher, enabled, last_used_counter")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.enabled) return { ok: false, message: "2FA yoqilmagan" };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRes?.user?.email;
    if (!email) return { ok: false, message: GENERIC_ERROR };

    const authClient = createAuthClient();
    if (!authClient) return { ok: false, message: "Server sozlamalarida xatolik" };
    const { error: pwError } = await authClient.auth.signInWithPassword({ email, password: data.password });
    if (pwError) return { ok: false, message: GENERIC_ERROR };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    const label = profile?.phone ? `+${profile.phone.replace(/\D/g, "")}` : email;

    const check = mfa.verifyTotp(
      mfa.decryptSecret(row.secret_cipher),
      label,
      data.code,
      row.last_used_counter,
    );
    if (!check.valid) return { ok: false, message: GENERIC_ERROR };

    await supabaseAdmin.from("mfa_backup_codes").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("user_mfa").delete().eq("user_id", context.userId);
    await mfa.clearAttempts(supabaseAdmin, bucket, "mfa_disable");
    return { ok: true };
  });

/**
 * Login 2-qadam: parol tasdiqlangandan keyingi challenge uchun TOTP yoki
 * zaxira kodni tekshiradi va faqat shundan keyin sessiya tokenlarini qaytaradi.
 */
export const verifyMfaChallenge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        challengeToken: z.string().min(20).max(200),
        code: z.string().trim().min(6).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<MfaVerifyResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mfa = await import("@/lib/mfa.server");

    const bucket = `challenge:${data.challengeId}`;
    const limit = await mfa.checkRateLimit(supabaseAdmin, bucket, "mfa_login", 5, 900);
    if (!limit.allowed) {
      return { ok: false, message: "Juda ko'p noto'g'ri urinish. Birozdan so'ng qayta urining" };
    }
    await mfa.recordAttempt(supabaseAdmin, bucket, "mfa_login");

    const { data: challenge } = await supabaseAdmin
      .from("mfa_challenges")
      .select("id, user_id, token_hash, session_cipher, consumed_at, expires_at")
      .eq("id", data.challengeId)
      .maybeSingle();

    const invalid: MfaVerifyResult = { ok: false, message: "Kod noto'g'ri yoki muddati tugagan" };
    if (!challenge || challenge.consumed_at) return invalid;
    if (new Date(challenge.expires_at).getTime() < Date.now()) return invalid;
    if (!mfa.safeEqual(challenge.token_hash, mfa.hashToken(data.challengeToken))) return invalid;

    const { data: row } = await supabaseAdmin
      .from("user_mfa")
      .select("secret_cipher, enabled, last_used_counter")
      .eq("user_id", challenge.user_id)
      .maybeSingle();
    if (!row?.enabled) return invalid;

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(challenge.user_id);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", challenge.user_id)
      .maybeSingle();
    const label = profile?.phone ? `+${profile.phone.replace(/\D/g, "")}` : (userRes?.user?.email ?? "user");

    let accepted = false;
    const digitsOnly = data.code.replace(/\D/g, "");
    if (/^\d{6}$/.test(data.code.trim()) && digitsOnly.length === 6) {
      const check = mfa.verifyTotp(
        mfa.decryptSecret(row.secret_cipher),
        label,
        data.code,
        row.last_used_counter,
      );
      if (check.valid) {
        accepted = true;
        await supabaseAdmin
          .from("user_mfa")
          .update({ last_used_counter: check.counter })
          .eq("user_id", challenge.user_id);
      }
    } else {
      // Zaxira kod: bir martalik, hash bo'yicha qidiriladi.
      const hash = mfa.hashBackupCode(data.code);
      const { data: backup } = await supabaseAdmin
        .from("mfa_backup_codes")
        .select("id")
        .eq("user_id", challenge.user_id)
        .eq("code_hash", hash)
        .is("used_at", null)
        .maybeSingle();
      if (backup) {
        const { data: consumed } = await supabaseAdmin
          .from("mfa_backup_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", backup.id)
          .is("used_at", null)
          .select("id")
          .maybeSingle();
        accepted = !!consumed;
      }
    }

    if (!accepted) return invalid;

    await supabaseAdmin
      .from("mfa_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);
    await mfa.clearAttempts(supabaseAdmin, bucket, "mfa_login");

    const session = JSON.parse(mfa.decryptSecret(challenge.session_cipher)) as {
      access_token: string;
      refresh_token: string;
    };
    return { ok: true, accessToken: session.access_token, refreshToken: session.refresh_token };
  });
