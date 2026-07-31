import { createFileRoute } from "@tanstack/react-router";

import { PropertyListPage } from "@/components/PropertyListPage";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/ijara")({
  head: () => ({
    meta: [
      { title: "Ijaradagi uy-joylar — UBU Real Estate" },
      {
        name: "description",
        content: "Toshkent va boshqa hududlarda ijaraga beriladigan kvartira va uylar.",
      },
      { property: "og:title", content: "Ijaradagi uy-joylar — UBU Real Estate" },
      {
        property: "og:description",
        content: "Ijara e'lonlarini har bir foydalanuvchi joylashtira oladi.",
      },
    ],
  }),
  component: RentPage,
});

function RentPage() {
  return (
    <PageShell>
      <PropertyListPage
        dealType="rent"
        title="Ijaradagi obyektlar"
        subtitle="Ijara e'lonlarini barcha foydalanuvchilar joylashtira oladi."
      />
    </PageShell>
  );
}
