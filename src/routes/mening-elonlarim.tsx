import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CardSkeletonGrid, EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { StorageImage } from "@/components/StorageImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatPrice } from "@/lib/format";
import { fetchMyProperties } from "@/lib/properties";
import { PROPERTY_BUCKET } from "@/lib/storage";
import { DEAL_TYPE_LABELS, LISTING_STATUS_LABELS } from "@/lib/uz";

export const Route = createFileRoute("/mening-elonlarim")({
  head: () => ({
    meta: [
      { title: "Mening e'lonlarim — UBU Real Estate" },
      { name: "description", content: "Joylashtirgan e'lonlaringiz va ularning moderatsiya holati." },
      { property: "og:title", content: "Mening e'lonlarim — UBU Real Estate" },
      { property: "og:description", content: "E'lonlaringiz holati." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-properties", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyProperties(user!.id),
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Mening e'lonlarim</h1>
          <Button asChild size="sm">
            <Link to="/joylash">Yangi e'lon</Link>
          </Button>
        </div>

        {loading || (user && isLoading) ? (
          <CardSkeletonGrid count={3} />
        ) : !user ? (
          <EmptyState
            title="Tizimga kiring"
            description="E'lonlaringizni ko'rish uchun hisobingizga kiring."
            action={
              <Button asChild size="sm">
                <Link to="/auth">Kirish</Link>
              </Button>
            }
          />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Hali e'lon joylashtirmagansiz"
            description="Birinchi e'loningizni joylashtiring — u moderatsiyadan so'ng chop etiladi."
            action={
              <Button asChild size="sm">
                <Link to="/joylash">E'lon joylash</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {data!.map((property) => (
              <li key={property.id} className="surface-card flex gap-4 p-3">
                <StorageImage
                  bucket={PROPERTY_BUCKET}
                  path={property.images[0]}
                  alt={property.title}
                  className="h-24 w-32 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={property.status === "approved" ? "default" : "secondary"}>
                      {LISTING_STATUS_LABELS[property.status]}
                    </Badge>
                    <Badge variant="outline">{DEAL_TYPE_LABELS[property.deal_type]}</Badge>
                  </div>
                  <h2 className="mt-1 line-clamp-1 text-sm font-semibold">{property.title}</h2>
                  <p className="text-primary text-sm font-semibold">
                    {formatPrice(property.price, property.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(property.created_at)} · {property.views_count} ko'rish
                  </p>
                  {property.status === "approved" && (
                    <Link
                      to="/elon/$id"
                      params={{ id: property.id }}
                      className="text-primary mt-1 inline-block text-xs hover:underline"
                    >
                      E'lonni ochish
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
