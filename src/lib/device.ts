const STORAGE_KEY = "ubu_device_id";

/** Brauzerda saqlanadigan barqaror qurilma identifikatori. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}
