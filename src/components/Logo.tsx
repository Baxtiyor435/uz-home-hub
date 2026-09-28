import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/ubu-logo.jpg.asset.json";
import { APP_NAME } from "@/lib/uz";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)} aria-label={APP_NAME}>
      <img
        src={logoAsset.url}
        alt="UBU logotipi"
        className="border-primary/30 h-9 w-9 rounded-xl border object-cover"
        loading="lazy"
      />
      {!compact && (
        <span className="font-display text-lg leading-none font-bold tracking-tight">
          UBU
        </span>
      )}
    </Link>
  );
}
