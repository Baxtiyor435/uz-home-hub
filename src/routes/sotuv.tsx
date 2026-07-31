import { createFileRoute } from "@tanstack/react-router";

import { PropertyListPage } from "@/components/PropertyListPage";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/sotuv")({
  head: () => ({
    meta: [
      { title: "Sotuvdagi uy-joylar — UBU Real Estate" },
      {
        name: "description",
        content:
          "Tasdiqlangan agentlar tomonidan joylashtirilgan sotuvdagi kvartira, uy va tijorat obyektlari.",
      },
      { property: "og:title", content: "Sotuvdagi uy-joylar — UBU Real Estate" },
      {
        property: "og:description",
        content: "Faqat tasdiqlangan agentlarning sotuv e'lonlari.",
      },
    ],
  }),
  component: SalePage,
});

function SalePage() {
  return (
    <PageShell>
      <PropertyListPage
        dealType="sale"
        title="Sotuvdagi obyektlar"
        subtitle="Sotuv e'lonlarini faqat tasdiqlangan agentlar joylashtiradi."
      />
    </PageShell>
  );
}
