/**
 * Server-only 2FA (TOTP) helpers.
 * Never import this file from client code.
 *
 * Security notes:
 *  - TOTP secrets are stored AES-256-GCM encrypted with MFA_ENCRYPTION_KEY.
 *  - Backup codes are stored as HMAC-SHA256 hashes only.
 *  - Nothing here logs secrets, codes or tokens.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import * as OTPAuth from "otpauth";

export const APP_ISSUER = "UBU Real Estate";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // ±30s clock drift (RFC 6238)

function keyMaterial(): Buffer {
  const raw = process.env["MFA_ENCRYPTION_KEY"];
  if (!raw) throw new Error("MFA_ENCRYPTION_KEY is not configured");
  // Derive a stable 32-byte key from the configured secret.
  return createHmac("sha256", "ubu-mfa-key-v1").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid cipher payload");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function hashToken(value: string): string {
  return createHmac("sha256", keyMaterial()).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(secret: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: APP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function buildOtpauthUri(secret: string, label: string): string {
  return buildTotp(secret, label).toString();
}

/**
 * Verifies a 6-digit TOTP code. Returns the matched counter so the caller can
 * reject replays of an already-used time step.
 */
export function verifyTotp(
  secret: string,
  label: string,
  code: string,
  lastUsedCounter: number | null,
): { valid: boolean; counter: number | null } {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== TOTP_DIGITS) return { valid: false, counter: null };
  const delta = buildTotp(secret, label).validate({ token: normalized, window: TOTP_WINDOW });
  if (delta === null) return { valid: false, counter: null };
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD) + delta;
  if (lastUsedCounter !== null && counter <= lastUsedCounter) return { valid: false, counter: null };
  return { valid: true, counter };
}

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(10);
    let raw = "";
    for (const byte of bytes) raw += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function normalizeBackupCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashBackupCode(value: string): string {
  return hashToken(`backup:${normalizeBackupCode(value)}`);
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

type AdminClient = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Sliding-window limiter backed by public.auth_attempts.
 * Blocks brute-force attempts on login and 2FA verification.
 */
export async function checkRateLimit(
  admin: AdminClient,
  bucketKey: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { data } = await admin
    .from("auth_attempts")
    .select("created_at")
    .eq("bucket_key", bucketKey)
    .eq("action", action)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const attempts = data ?? [];
  if (attempts.length < limit) return { allowed: true, retryAfterSeconds: 0 };

  const oldest = new Date(attempts[0]!.created_at).getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - Date.now()) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export async function recordAttempt(admin: AdminClient, bucketKey: string, action: string) {
  await admin.from("auth_attempts").insert({ bucket_key: bucketKey, action });
}

export async function clearAttempts(admin: AdminClient, bucketKey: string, action: string) {
  await admin.from("auth_attempts").delete().eq("bucket_key", bucketKey).eq("action", action);
}
