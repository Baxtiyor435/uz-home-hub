import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BedDouble,
  Building2,
  Eye,
  Heart,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { StorageImage } from "@/components/StorageImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatArea, formatDate, formatPhone, formatPrice } from "@/lib/format";
import { fetchPropertyById } from "@/lib/properties";
import { PROPERTY_BUCKET } from "@/lib/storage";
import { CHAT_INTRO_MESSAGE, DEAL_TYPE_LABELS, PROPERTY_KIND_LABELS } from "@/lib/uz";

export const Route = createFileRoute("/elon/$id")({
  head: () => ({
    meta: [
      { title: "E'lon tafsilotlari — UBU Real Estate" },
      { name: "description", content: "Tasdiqlangan e'lon haqida to'liq ma'lumot va egasi bilan aloqa." },
      { property: "og:title", content: "E'lon tafsilotlari — UBU Real Estate" },
      { property: "og:description", content: "Tasdiqlangan e'lon haqida to'liq ma'lumot." },
    ],
  }),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => fetchPropertyById(id),
  });

  const { data: owner } = useQuery({
    queryKey: ["profile-public", property?.owner_id],
    enabled: !!property?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, agency_name, rating, reviews_count, is_verified_agent, avatar_url")
        .eq("id", property!.owner_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: favorite } = useQuery({
    queryKey: ["favorite", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("property_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("AUTH");
      if (favorite) {
        const { error } = await supabase.from("favorites").delete().eq("id", favorite.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("favorites").insert({ property_id: id, user_id: user.id });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ["favorite", id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
      toast.success(added ? "Sevimlilarga qo'shildi" : "Sevimlilardan olib tashlandi");
    },
    onError: (error: Error) => {
      if (error.message === "AUTH") {
        toast.error("Avval tizimga kiring");
        navigate({ to: "/auth" });
        return;
      }
      toast.error("Amalni bajarib bo'lmadi");
    },
  });

  const startChat = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("AUTH");
      if (!property) throw new Error("NO_PROPERTY");
      if (property.owner_id === user.id) throw new Error("SELF");

      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("property_id", property.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ property_id: property.id, user_id: user.id, agent_id: property.owner_id })
        .select("id")
        .single();
      if (error) throw error;

      await supabase
        .from("messages")
        .insert({ conversation_id: created.id, sender_id: user.id, body: CHAT_INTRO_MESSAGE });

      return created.id;
    },
    onSuccess: (conversationId) => navigate({ to: "/suhbatlar/$id", params: { id: conversationId } }),
    onError: (error: Error) => {
      if (error.message === "AUTH") {
        toast.error("Avval tizimga kiring");
        navigate({ to: "/auth" });
        return;
      }
      if (error.message === "SELF") {
        toast.error("Bu sizning e'loningiz");
        return;
      }
      toast.error("Suhbatni ochib bo'lmadi");
    },
  });

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="bg-muted aspect-video animate-pulse rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  if (!property) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="E'lon topilmadi"
            description="E'lon o'chirilgan yoki hali tasdiqlanmagan bo'lishi mumkin."
            action={
              <Button asChild size="sm">
                <Link to="/">Bosh sahifa</Link>
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <article className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <StorageImage
            bucket={PROPERTY_BUCKET}
            path={property.images[0]}
            alt={property.title}
            className="aspect-4/3 w-full rounded-2xl sm:col-span-2"
          />
          {property.images.slice(1, 5).map((path) => (
            <StorageImage
              key={path}
              bucket={PROPERTY_BUCKET}
              path={path}
              alt={property.title}
              className="aspect-4/3 w-full rounded-xl"
            />
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={property.deal_type === "rent" ? "secondary" : "default"}>
                  {DEAL_TYPE_LABELS[property.deal_type]}
                </Badge>
                <Badge variant="outline">{PROPERTY_KIND_LABELS[property.kind]}</Badge>
              </div>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{property.title}</h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-1 text-sm">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {property.region}, {property.district}, {property.address}
              </p>
              <p className="font-display text-primary mt-3 text-2xl font-bold">
                {formatPrice(property.price, property.currency)}
                {property.deal_type === "rent" && (
                  <span className="text-muted-foreground text-base font-medium"> / oyiga</span>
                )}
              </p>
            </div>

            <dl className="surface-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Stat icon={BedDouble} label="Xonalar" value={`${property.rooms} ta`} />
              <Stat icon={Ruler} label="Maydon" value={formatArea(property.area)} />
              <Stat
                icon={Layers}
                label="Qavat"
                value={property.floor ? `${property.floor}/${property.total_floors ?? "-"}` : "-"}
              />
              <Stat icon={Eye} label="Ko'rishlar" value={`${property.views_count}`} />
            </dl>

            <section className="surface-card p-5">
              <h2 className="font-display mb-2 text-lg font-semibold">Tavsif</h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {property.description || "Tavsif kiritilmagan."}
              </p>
            </section>

            {property.features.length > 0 && (
              <section className="surface-card p-5">
                <h2 className="font-display mb-3 text-lg font-semibold">Qulayliklar</h2>
                <ul className="flex flex-wrap gap-2">
                  {property.features.map((feature) => (
                    <li key={feature}>
                      <Badge variant="outline">{feature}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="font-display mb-3 text-base font-semibold">E'lon egasi</h2>
              <div className="flex items-center gap-3">
                <span className="bg-accent text-accent-foreground flex h-11 w-11 items-center justify-center rounded-full">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {owner?.full_name || "Foydalanuvchi"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {owner?.is_verified_agent
                      ? `Tasdiqlangan agent${owner.agency_name ? ` · ${owner.agency_name}` : ""}`
                      : "Xususiy e'lon beruvchi"}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mt-4 text-xs">
                Telefon: {user ? formatPhone(owner?.phone) : "Ko'rish uchun tizimga kiring"}
              </p>

              <div className="mt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => startChat.mutate()}
                  disabled={startChat.isPending}
                >
                  {startChat.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Yozish
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toggleFavorite.mutate()}
                  disabled={toggleFavorite.isPending}
                >
                  <Heart className={favorite ? "mr-2 h-4 w-4 fill-current" : "mr-2 h-4 w-4"} />
                  {favorite ? "Sevimlilarda" : "Sevimlilarga"}
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              E'lon {formatDate(property.created_at)} sanasida joylashtirilgan va moderatsiyadan
              o'tgan.
            </p>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground flex items-center gap-1 text-xs">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
