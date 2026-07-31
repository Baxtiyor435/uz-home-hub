import { Link } from "@tanstack/react-router";
import { BedDouble, Layers, MapPin, Ruler } from "lucide-react";

import { StorageImage } from "@/components/StorageImage";
import { Badge } from "@/components/ui/badge";
import { formatArea, formatPrice, formatRelativeTime } from "@/lib/format";
import { PROPERTY_BUCKET } from "@/lib/storage";
import type { PropertyRow } from "@/lib/properties";
import { PROPERTY_KIND_LABELS } from "@/lib/uz";

export function PropertyCard({ property }: { property: PropertyRow }) {
  return (
    <Link
      to="/elon/$id"
      params={{ id: property.id }}
      className="surface-card group focus-visible:ring-ring block overflow-hidden transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="relative aspect-4/3 overflow-hidden">
        <StorageImage
          bucket={PROPERTY_BUCKET}
          path={property.images[0]}
          alt={property.title}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
        />
        <Badge className="absolute top-3 left-3" variant={property.deal_type === "rent" ? "secondary" : "default"}>
          {property.deal_type === "rent" ? "Ijara" : "Sotuv"}
        </Badge>
      </div>

      <div className="space-y-2 p-4">
        <p className="font-display text-lg font-bold">
          {formatPrice(property.price, property.currency)}
          {property.deal_type === "rent" && (
            <span className="text-muted-foreground text-sm font-medium"> / oyiga</span>
          )}
        </p>
        <h3 className="line-clamp-1 text-sm font-semibold">{property.title}</h3>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="line-clamp-1">
            {property.region}, {property.district}
          </span>
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
            {property.rooms} xona
          </span>
          <span className="flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            {formatArea(property.area)}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {PROPERTY_KIND_LABELS[property.kind]}
          </span>
        </div>
        <p className="text-muted-foreground pt-1 text-[11px]">
          {formatRelativeTime(property.created_at)}
        </p>
      </div>
    </Link>
  );
}
