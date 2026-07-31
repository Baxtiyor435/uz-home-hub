import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format";

export const Route = createFileRoute("/suhbatlar/")({
  head: () => ({
    meta: [
      { title: "Suhbatlar — UBU Real Estate" },
      { name: "description", content: "E'lon egalari bilan yozishmalaringiz." },
      { property: "og:title", content: "Suhbatlar — UBU Real Estate" },
      { property: "og:description", content: "Yozishmalaringiz." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, last_message_at, properties(title)")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display mb-6 text-2xl font-bold sm:text-3xl">Suhbatlar</h1>

        {loading || (user && isLoading) ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="surface-card bg-muted h-16 animate-pulse" />
            ))}
          </div>
        ) : !user ? (
          <EmptyState
            title="Tizimga kiring"
            description="Yozishmalarni ko'rish uchun hisobingizga kiring."
            action={
              <Button asChild size="sm">
                <Link to="/auth">Kirish</Link>
              </Button>
            }
          />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Suhbatlar yo'q"
            description="E'lon sahifasidagi «Yozish» tugmasi orqali suhbat boshlang."
          />
        ) : (
          <ul className="space-y-2">
            {data!.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to="/suhbatlar/$id"
                  params={{ id: conversation.id }}
                  className="surface-card hover:bg-accent flex items-center justify-between gap-3 p-4 transition-colors"
                >
                  <span className="line-clamp-1 text-sm font-medium">
                    {(conversation.properties as { title?: string } | null)?.title ?? "E'lon"}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatRelativeTime(conversation.last_message_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
