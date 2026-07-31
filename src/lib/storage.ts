import { supabase } from "@/integrations/supabase/client";

export const PROPERTY_BUCKET = "property-images";
export const AVATAR_BUCKET = "avatars";

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

/** Resolves a storage path to a temporary readable URL. */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedUrls(bucket: string, paths: string[]): Promise<string[]> {
  const local = paths.filter((p) => !!p);
  if (local.length === 0) return [];
  const remote = local.filter((p) => !p.startsWith("http"));
  if (remote.length === 0) return local;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(remote, SIGNED_URL_TTL);
  if (error || !data) return [];
  const map = new Map(data.map((item) => [item.path, item.signedUrl]));
  return local.map((p) => (p.startsWith("http") ? p : (map.get(p) ?? ""))).filter(Boolean);
}

/** Uploads one image into the current user's folder and returns its storage path. */
export async function uploadImage(bucket: string, userId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("Rasmni yuklashda xatolik yuz berdi");
  return path;
}
