import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CardSkeletonGrid, EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { PropertyRow } from "@/lib/properties";

export const Route = createFileRoute("/sevimlilar")({
  head: () => ({
    meta: [
      { title: "Sevimli e'lonlar — UBU Real Estate" },
      { name: "description", content: "Saqlab qo'ygan uy-joy e'lonlaringiz ro'yxati." },
      { property: "og:title", content: "Sevimli e'lonlar — UBU Real Estate" },
      { property: "og:description", content: "Saqlab qo'ygan e'lonlaringiz." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("property_id, properties(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.properties as unknown as PropertyRow | null)
        .filter((row): row is PropertyRow => !!row);
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display mb-6 text-2xl font-bold sm:text-3xl">Sevimlilar</h1>

        {loading || (user && isLoading) ? (
          <CardSkeletonGrid count={3} />
        ) : !user ? (
          <EmptyState
            title="Tizimga kiring"
            description="Sevimli e'lonlarni ko'rish uchun hisobingizga kiring."
            action={
              <Button asChild size="sm">
                <Link to="/auth">Kirish</Link>
              </Button>
            }
          />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Sevimlilar bo'sh"
            description="E'lon sahifasidagi yurakcha tugmasi orqali saqlab qo'ying."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
