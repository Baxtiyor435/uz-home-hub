import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
      <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden">
          <div className="bg-muted aspect-4/3 animate-pulse" />
          <div className="space-y-2 p-4">
            <div className="bg-muted h-5 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
