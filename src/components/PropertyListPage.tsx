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
import { fetchProperties, type PropertyFilters } from "@/lib/properties";
import { PROPERTY_KIND_LABELS, REGIONS, type DealType } from "@/lib/uz";

export function PropertyListPage({
  dealType,
  title,
  subtitle,
}: {
  dealType: DealType;
  title: string;
  subtitle: string;
}) {
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
          placeholder="Qidiruv: sarlavha yoki tuman"
          value={filters.search ?? ""}
          onChange={(event) => update({ search: event.target.value })}
          maxLength={80}
          aria-label="Qidiruv"
        />

        <Select value={filters.region ?? "all"} onValueChange={(value) => update({ region: value })}>
          <SelectTrigger aria-label="Hudud">
            <SelectValue placeholder="Hudud" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha hududlar</SelectItem>
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
          <SelectTrigger aria-label="Turi">
            <SelectValue placeholder="Turi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha turlari</SelectItem>
            {Object.entries(PROPERTY_KIND_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort ?? "new"}
          onValueChange={(value) => update({ sort: value as NonNullable<PropertyFilters["sort"]> })}
        >
          <SelectTrigger aria-label="Saralash">
            <SelectValue placeholder="Saralash" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Avval yangilari</SelectItem>
            <SelectItem value="price_asc">Narx: arzondan</SelectItem>
            <SelectItem value="price_desc">Narx: qimmatdan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardSkeletonGrid />
      ) : isError ? (
        <EmptyState
          title="E'lonlarni yuklab bo'lmadi"
          description="Internet aloqasini tekshirib, sahifani yangilang."
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="E'lonlar topilmadi"
          description="Filtrlarni o'zgartirib ko'ring yoki keyinroq qayta tekshiring."
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
