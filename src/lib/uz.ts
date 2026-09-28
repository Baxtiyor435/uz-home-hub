/**
 * Shared domain constants and Uzbek (Latin) labels.
 * All user-facing strings in the app live here or in the components.
 */

export const APP_NAME = "UBU";
export const APP_SLOGAN = "Har bir e'lon tasdiqlangan. Har bir bitim xavfsiz.";

export type DealType = "sale" | "rent";
export type PropertyKind = "apartment" | "house" | "commercial" | "land";
export type ListingStatus = "pending" | "approved" | "rejected" | "archived";
export type AppRole = "user" | "agent" | "admin" | "super_admin";

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  sale: "Sotuv",
  rent: "Ijara",
};

export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  apartment: "Kvartira",
  house: "Uy / Hovli",
  commercial: "Tijorat obyekti",
  land: "Yer uchastkasi",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  pending: "Tasdiqlash kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  archived: "Arxivlangan",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  user: "Foydalanuvchi",
  agent: "Agent",
  admin: "Administrator",
  super_admin: "Bosh administrator",
};

export const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Xorazm viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Qoraqalpog'iston Respublikasi",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
] as const;

export const FEATURE_OPTIONS = [
  "Mebel bilan",
  "Konditsioner",
  "Yevroremont",
  "Lift",
  "Balkon",
  "Avtoturargoh",
  "Internet",
  "Kir yuvish mashinasi",
  "Hovli",
  "Qo'riqlanadigan hudud",
] as const;

/** Default prices; live values are read from platform settings. */
export const DEFAULT_UNLOCK_PRICE = 11990;
export const DEFAULT_PREMIUM_PRICE = 11990;

export const CHAT_INTRO_MESSAGE =
  "Assalomu alaykum. Men ushbu uyga qiziqib qoldim. Iltimos, batafsil ma'lumot bera olasizmi?";
