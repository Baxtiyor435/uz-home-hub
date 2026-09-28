import { createFileRoute } from "@tanstack/react-router";

import { PropertyListPage } from "@/components/PropertyListPage";
import { PageShell } from "@/components/PageShell";
import { useTr } from "@/lib/i18n";

export const Route = createFileRoute("/sotuv")({
  head: () => ({
    meta: [
      { title: "Sotuvdagi uy-joylar — UBU" },
      {
        name: "description",
        content:
          "Tasdiqlangan agentlar tomonidan joylashtirilgan sotuvdagi kvartira, uy va tijorat obyektlari.",
      },
      { property: "og:title", content: "Sotuvdagi uy-joylar — UBU" },
      {
        property: "og:description",
        content: "Faqat tasdiqlangan agentlarning sotuv e'lonlari.",
      },
    ],
  }),
  component: SalePage,
});

function SalePage() {
  const tr = useTr();
  return (
    <PageShell>
      <PropertyListPage
        dealType="sale"
        title={tr("Sotuvdagi obyektlar", "Объекты на продажу")}
        subtitle={tr(
          "Sotuv e'lonlarini faqat tasdiqlangan agentlar joylashtiradi.",
          "Объявления о продаже размещают только проверенные агенты.",
        )}
      />
    </PageShell>
  );
}
