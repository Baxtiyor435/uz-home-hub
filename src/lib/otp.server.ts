/**
 * Server-only OTP helpers: code generation/verification and Eskiz.uz SMS delivery.
 * Never import this file from client code.
 */

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

export const otpConfig = {
  ttlMinutes: OTP_TTL_MINUTES,
  maxAttempts: OTP_MAX_ATTEMPTS,
  resendSeconds: OTP_RESEND_SECONDS,
};

export function generateOtpCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(100000 + ((buffer[0] ?? 0) % 900000));
}

export async function hashOtpCode(phone: string, code: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${phone}:${code}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateStrongPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(36))
    .join("")
    .slice(0, 48);
}

/** Deterministic internal login identity derived from the phone number. */
export function phoneToEmail(phone: string): string {
  return `${phone}@phone.ubu-realestate.uz`;
}

const ESKIZ_BASE_URL = "https://notify.eskiz.uz/api";

async function getEskizToken(email: string, password: string): Promise<string> {
  const body = new FormData();
  body.append("email", email);
  body.append("password", password);

  const response = await fetch(`${ESKIZ_BASE_URL}/auth/login`, { method: "POST", body });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Eskiz auth failed [${response.status}]: ${text}`);
  }
  const json = (await response.json()) as { data?: { token?: string } };
  const token = json.data?.token;
  if (!token) throw new Error("Eskiz auth response did not contain a token");
  return token;
}

/** Sends the OTP SMS. Throws when the provider rejects the request. */
export async function sendSms(phone: string, message: string): Promise<void> {
  const email = process.env["ESKIZ_EMAIL"];
  const password = process.env["ESKIZ_PASSWORD"];
  if (!email || !password) {
    throw new Error("SMS_NOT_CONFIGURED");
  }

  const token = await getEskizToken(email, password);
  const body = new FormData();
  body.append("mobile_phone", phone);
  body.append("message", message);
  body.append("from", process.env["ESKIZ_SENDER"] ?? "4546");

  const response = await fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Eskiz send failed [${response.status}]: ${text}`);
  }
}
