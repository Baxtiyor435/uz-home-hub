import { createFileRoute } from "@tanstack/react-router";

import { PropertyListPage } from "@/components/PropertyListPage";
import { PageShell } from "@/components/PageShell";
import { useTr } from "@/lib/i18n";

export const Route = createFileRoute("/ijara")({
  head: () => ({
    meta: [
      { title: "Ijaradagi uy-joylar — UBU" },
      {
        name: "description",
        content: "Toshkent va boshqa hududlarda ijaraga beriladigan kvartira va uylar.",
      },
      { property: "og:title", content: "Ijaradagi uy-joylar — UBU" },
      {
        property: "og:description",
        content: "Ijara e'lonlarini har bir foydalanuvchi joylashtira oladi.",
      },
    ],
  }),
  component: RentPage,
});

function RentPage() {
  const tr = useTr();
  return (
    <PageShell>
      <PropertyListPage
        dealType="rent"
        title={tr("Ijaradagi obyektlar", "Объекты в аренде")}
        subtitle={tr(
          "Ijara e'lonlarini barcha foydalanuvchilar joylashtira oladi.",
          "Объявления об аренде может размещать любой пользователь.",
        )}
      />
    </PageShell>
  );
}
