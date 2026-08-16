import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState, CardSkeletonGrid } from "@/components/EmptyState";
import { PropertyCard } from "@/components/PropertyCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_KIND_I18N, useLang } from "@/lib/i18n";
import { fetchProperties, type PropertyFilters } from "@/lib/properties";
import { REGIONS, type DealType } from "@/lib/uz";

export function PropertyListPage({
  dealType,
  title,
  subtitle,
}: {
  dealType: DealType;
  title: string;
  subtitle: string;
}) {
  const { lang, t } = useLang();
  const [filters, setFilters] = useState<PropertyFilters>({ dealType, sort: "new" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["properties", filters],
    queryFn: () => fetchProperties(filters),
  });

  function update(patch: Partial<PropertyFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </header>

      <div className="surface-card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t("list.search")}
          value={filters.search ?? ""}
          onChange={(event) => update({ search: event.target.value })}
          maxLength={80}
          aria-label={t("list.searchLabel")}
        />

        <Select value={filters.region ?? "all"} onValueChange={(value) => update({ region: value })}>
          <SelectTrigger aria-label={t("list.region")}>
            <SelectValue placeholder={t("list.region")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("list.allRegions")}</SelectItem>
            {REGIONS.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.kind ?? "all"}
          onValueChange={(value) => update({ kind: value as NonNullable<PropertyFilters["kind"]> })}
        >
          <SelectTrigger aria-label={t("list.kind")}>
            <SelectValue placeholder={t("list.kind")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("list.allKinds")}</SelectItem>
            {Object.entries(PROPERTY_KIND_I18N).map(([value, labels]) => (
              <SelectItem key={value} value={value}>
                {labels[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort ?? "new"}
          onValueChange={(value) => update({ sort: value as NonNullable<PropertyFilters["sort"]> })}
        >
          <SelectTrigger aria-label={t("list.sort")}>
            <SelectValue placeholder={t("list.sort")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("list.sortNew")}</SelectItem>
            <SelectItem value="price_asc">{t("list.sortAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("list.sortDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardSkeletonGrid />
      ) : isError ? (
        <EmptyState
          title={t("list.errorTitle")}
          description={t("list.errorText")}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title={t("list.emptyTitle")}
          description={t("list.emptyText")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
