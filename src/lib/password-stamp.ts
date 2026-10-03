import { createHash } from "node:crypto";

const PEPPER = "ubu-password-stamp-v1";

/** Server-only marker so an older Supabase password cannot keep signing in. */
export function passwordStamp(password: string): string {
  return createHash("sha256").update(`${PEPPER}:${password}`).digest("hex");
}
