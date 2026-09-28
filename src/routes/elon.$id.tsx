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
import { useTr } from "@/lib/i18n";

export const Route = createFileRoute("/elon/$id")({
  head: () => ({
    meta: [
      { title: "E'lon tafsilotlari — UBU" },
      { name: "description", content: "Tasdiqlangan e'lon haqida to'liq ma'lumot va egasi bilan aloqa." },
      { property: "og:title", content: "E'lon tafsilotlari — UBU" },
      { property: "og:description", content: "Tasdiqlangan e'lon haqida to'liq ma'lumot." },
    ],
  }),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const { id } = Route.useParams();
  const tr = useTr();
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
      toast.success(added ? tr("Sevimlilarga qo'shildi", "Добавлено в избранное") : tr("Sevimlilardan olib tashlandi", "Удалено из избранного"));
    },
    onError: (error: Error) => {
      if (error.message === "AUTH") {
        toast.error(tr("Avval tizimga kiring", "Сначала войдите в систему"));
        navigate({ to: "/auth" });
        return;
      }
      toast.error(tr("Amalni bajarib bo'lmadi", "Не удалось выполнить действие"));
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
        toast.error(tr("Avval tizimga kiring", "Сначала войдите в систему"));
        navigate({ to: "/auth" });
        return;
      }
      if (error.message === "SELF") {
        toast.error(tr("Bu sizning e'loningiz", "Это ваше объявление"));
        return;
      }
      toast.error(tr("Suhbatni ochib bo'lmadi", "Не удалось открыть чат"));
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
            title={tr("E'lon topilmadi", "Объявление не найдено")}
            description={tr(
              "E'lon o'chirilgan yoki hali tasdiqlanmagan bo'lishi mumkin.",
              "Возможно, объявление удалено или ещё не одобрено.",
            )}
            action={
              <Button asChild size="sm">
                <Link to="/">{tr("Bosh sahifa", "Главная")}</Link>
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
                  <span className="text-muted-foreground text-base font-medium"> {tr("/ oyiga", "/ в месяц")}</span>
                )}
              </p>
            </div>

            <dl className="surface-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Stat icon={BedDouble} label={tr("Xonalar", "Комнаты")} value={tr(`${property.rooms} ta`, `${property.rooms}`)} />
              <Stat icon={Ruler} label={tr("Maydon", "Площадь")} value={formatArea(property.area)} />
              <Stat
                icon={Layers}
                label={tr("Qavat", "Этаж")}
                value={property.floor ? `${property.floor}/${property.total_floors ?? "-"}` : "-"}
              />
              <Stat icon={Eye} label={tr("Ko'rishlar", "Просмотры")} value={`${property.views_count}`} />
            </dl>

            <section className="surface-card p-5">
              <h2 className="font-display mb-2 text-lg font-semibold">{tr("Tavsif", "Описание")}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {property.description || tr("Tavsif kiritilmagan.", "Описание не указано.")}
              </p>
            </section>

            {property.features.length > 0 && (
              <section className="surface-card p-5">
                <h2 className="font-display mb-3 text-lg font-semibold">{tr("Qulayliklar", "Удобства")}</h2>
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
              <h2 className="font-display mb-3 text-base font-semibold">{tr("E'lon egasi", "Владелец объявления")}</h2>
              <div className="flex items-center gap-3">
                <span className="bg-accent text-accent-foreground flex h-11 w-11 items-center justify-center rounded-full">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {owner?.full_name || tr("Foydalanuvchi", "Пользователь")}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {owner?.is_verified_agent
                      ? `${tr("Tasdiqlangan agent", "Проверенный агент")}${owner.agency_name ? ` · ${owner.agency_name}` : ""}`
                      : tr("Xususiy e'lon beruvchi", "Частное лицо")}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mt-4 text-xs">
                {tr("Telefon", "Телефон")}: {user ? formatPhone(owner?.phone) : tr("Ko'rish uchun tizimga kiring", "Войдите, чтобы увидеть")}
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
                  {tr("Yozish", "Написать")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toggleFavorite.mutate()}
                  disabled={toggleFavorite.isPending}
                >
                  <Heart className={favorite ? "mr-2 h-4 w-4 fill-current" : "mr-2 h-4 w-4"} />
                  {favorite ? tr("Sevimlilarda", "В избранном") : tr("Sevimlilarga", "В избранное")}
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {tr(
                `E'lon ${formatDate(property.created_at)} sanasida joylashtirilgan va moderatsiyadan o'tgan.`,
                `Объявление размещено ${formatDate(property.created_at)} и прошло модерацию.`,
              )}
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
