import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Star } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/format";

export const Route = createFileRoute("/agentlar")({
  head: () => ({
    meta: [
      { title: "Tasdiqlangan agentlar — UBU Real Estate" },
      {
        name: "description",
        content: "Reyting va sharhlar asosida tanlangan tasdiqlangan ko'chmas mulk agentlari.",
      },
      { property: "og:title", content: "Tasdiqlangan agentlar — UBU Real Estate" },
      { property: "og:description", content: "Tekshirilgan agentlar ro'yxati va reytinglari." },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, agency_name, bio, rating, reviews_count, deals_count, phone")
        .eq("is_verified_agent", true)
        .order("rating", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Tasdiqlangan agentlar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Agent maqomi administrator tomonidan hujjatlar asosida beriladi.
          </p>
        </header>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="surface-card bg-muted h-36 animate-pulse" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Hozircha tasdiqlangan agentlar yo'q"
            description="Agent bo'lishni istasangiz, profilingizdan ariza qoldiring."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((agent) => (
              <li key={agent.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{agent.full_name || "Agent"}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {agent.agency_name || "Mustaqil agent"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                    Tasdiqlangan
                  </Badge>
                </div>

                {agent.bio && (
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">{agent.bio}</p>
                )}

                <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {Number(agent.rating).toFixed(1)} ({agent.reviews_count})
                  </span>
                  <span>{agent.deals_count} bitim</span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">{formatPhone(agent.phone)}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted-foreground mt-8 text-sm">
          Agent bo'lish uchun{" "}
          <Link to="/profil" className="text-primary hover:underline">
            profilingizdan ariza yuboring
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
