/** Formatting helpers for Uzbek locale. */

export function formatPrice(amount: number | string, currency = "UZS"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "-";
  const formatted = new Intl.NumberFormat("uz-UZ", {
    maximumFractionDigits: 0,
  }).format(value);
  return `${formatted} ${currency === "UZS" ? "so'm" : currency}`;
}

export function formatArea(area: number | string): string {
  const value = typeof area === "string" ? Number(area) : area;
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(value)} m²`;
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hozirgina";
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} kun oldin`;
  return formatDate(date);
}

/** Displays +998 90 123 45 67 from 998901234567. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 12) return phone;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

/** Normalizes any user input to 998XXXXXXXXX, or null when invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const withCode = digits.startsWith("998") ? digits : `998${digits}`;
  return /^998\d{9}$/.test(withCode) ? withCode : null;
}

/** Masks an address for the free (locked) preview. */
export function maskAddress(region: string, district: string): string {
  return `${region}, ${district} (taxminiy hudud)`;
}
