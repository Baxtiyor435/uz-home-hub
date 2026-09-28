import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Building2, KeyRound, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useTr } from "@/lib/i18n";

import { CardSkeletonGrid, EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchProperties } from "@/lib/properties";
import { APP_SLOGAN } from "@/lib/uz";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UBU — tasdiqlangan ko'chmas mulk e'lonlari" },
      {
        name: "description",
        content:
          "O'zbekistonda uy sotib olish va ijaraga olish uchun ishonchli platforma. Har bir e'lon moderatsiyadan o'tadi.",
      },
      { property: "og:title", content: "UBU — tasdiqlangan e'lonlar" },
      { property: "og:description", content: APP_SLOGAN },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const tr = useTr();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["properties", "home"],
    queryFn: () => fetchProperties({ sort: "new" }),
  });

  const latest = (data ?? []).slice(0, 6);

  return (
    <PageShell>
      <section className="luxe-gradient border-b border-gold/20 text-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <p className="text-foreground/70 text-sm font-medium">{tr(APP_SLOGAN, "Каждое объявление проверено. Каждая сделка безопасна.")}</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-extrabold sm:text-5xl">
            {tr("Ishonchli uy-joyni ", "Найдите надёжное жильё ")}
            <br className="hidden sm:block" /> <span className="text-gold">UBU</span>{" "}
            {tr("orqali toping", "")}
          </h1>
          <p className="text-foreground/70 mx-auto mt-4 max-w-xl text-sm sm:text-base">
            {tr(
              "Barcha e'lonlar administrator tomonidan tekshiriladi. Sotuv e'lonlarini faqat tasdiqlangan agentlar joylashtiradi.",
              "Все объявления проверяются администратором. Объявления о продаже размещают только проверенные агенты.",
            )}
          </p>

          <form
            className="mx-auto mt-8 flex max-w-lg gap-2"
            onSubmit={(event) => event.preventDefault()}
            role="search"
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("Tuman yoki kalit so'z", "Район или ключевое слово")}
              maxLength={80}
              aria-label={tr("Qidiruv", "Поиск")}
              className="bg-input text-foreground"
            />
            <Button asChild variant="secondary" type="button">
              <Link to="/sotuv">
                <Search className="mr-1 h-4 w-4" />
                {tr("Qidirish", "Искать")}
              </Link>
            </Button>
          </form>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/sotuv">
                <Building2 className="mr-2 h-4 w-4" />
                {tr("Sotuvdagilar", "Продажа")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/ijara">
                <KeyRound className="mr-2 h-4 w-4" />
                {tr("Ijaradagilar", "Аренда")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: tr("Tasdiqlangan e'lonlar", "Проверенные объявления"),
            text: tr(
              "Har bir e'lon moderatordan o'tadi, soxta e'lonlar bloklanadi.",
              "Каждое объявление проходит модерацию, фейковые объявления блокируются.",
            ),
          },
          {
            icon: BadgeCheck,
            title: tr("Tekshirilgan agentlar", "Проверенные агенты"),
            text: tr(
              "Agent maqomi hujjatlar asosida beriladi va reyting bilan baholanadi.",
              "Статус агента присваивается на основании документов и оценивается по рейтингу.",
            ),
          },
          {
            icon: KeyRound,
            title: tr("Xavfsiz aloqa", "Безопасное общение"),
            text: tr(
              "Egasi bilan platforma ichida yozishing, kontakt himoyalangan.",
              "Переписывайтесь с владельцем внутри платформы, контакты защищены.",
            ),
          },
        ].map((item) => (
          <article key={item.title} className="surface-card p-5">
            <span className="bg-accent text-accent-foreground mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="font-display text-base font-semibold">{item.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold sm:text-2xl">{tr("So'nggi e'lonlar", "Последние объявления")}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/sotuv">{tr("Barchasi", "Все")}</Link>
          </Button>
        </div>

        {isLoading ? (
          <CardSkeletonGrid />
        ) : latest.length === 0 ? (
          <EmptyState
            title={tr("Hozircha e'lonlar yo'q", "Пока нет объявлений")}
            description={tr(
              "Birinchi bo'lib e'lon joylashtiring — moderatsiyadan so'ng u shu yerda ko'rinadi.",
              "Разместите первое объявление — после модерации оно появится здесь.",
            )}
            action={
              <Button asChild size="sm">
                <Link to="/joylash">{tr("E'lon joylash", "Разместить объявление")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
