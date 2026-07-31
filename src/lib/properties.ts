import { supabase } from "@/integrations/supabase/client";
import type { DealType, ListingStatus, PropertyKind } from "@/lib/uz";

export type PropertyRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  deal_type: DealType;
  kind: PropertyKind;
  price: number;
  currency: string;
  region: string;
  district: string;
  address: string;
  rooms: number;
  area: number;
  floor: number | null;
  total_floors: number | null;
  images: string[];
  features: string[];
  status: ListingStatus;
  views_count: number;
  created_at: string;
};

export type PropertyFilters = {
  dealType?: DealType;
  kind?: PropertyKind | "all";
  region?: string | "all";
  rooms?: number | "all";
  minPrice?: number | null;
  maxPrice?: number | null;
  search?: string;
  sort?: "new" | "price_asc" | "price_desc";
};

const LIST_COLUMNS =
  "id, owner_id, title, description, deal_type, kind, price, currency, region, district, address, rooms, area, floor, total_floors, images, features, status, views_count, created_at";

/** Public catalogue query — only approved listings are visible. */
export async function fetchProperties(filters: PropertyFilters): Promise<PropertyRow[]> {
  let query = supabase.from("properties").select(LIST_COLUMNS).eq("status", "approved");

  if (filters.dealType) query = query.eq("deal_type", filters.dealType);
  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.region && filters.region !== "all") query = query.eq("region", filters.region);
  if (filters.rooms && filters.rooms !== "all") {
    query = filters.rooms >= 4 ? query.gte("rooms", 4) : query.eq("rooms", filters.rooms);
  }
  if (filters.minPrice) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice) query = query.lte("price", filters.maxPrice);
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${term},district.ilike.${term},address.ilike.${term}`);
  }

  if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(60);
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export async function fetchPropertyById(id: string): Promise<PropertyRow | null> {
  const { data, error } = await supabase.from("properties").select(LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PropertyRow | null) ?? null;
}

export async function fetchMyProperties(userId: string): Promise<PropertyRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(`${LIST_COLUMNS}, reject_reason`)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}
