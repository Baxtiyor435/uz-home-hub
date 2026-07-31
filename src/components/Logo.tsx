import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { APP_NAME } from "@/lib/uz";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)} aria-label={APP_NAME}>
      <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="font-display text-lg leading-none font-bold tracking-tight">
          UBU<span className="text-primary"> Real Estate</span>
        </span>
      )}
    </Link>
  );
}
