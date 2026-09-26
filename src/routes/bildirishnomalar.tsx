import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTr } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bildirishnomalar")({
  head: () => ({
    meta: [
      { title: "Bildirishnomalar — UBU Real Estate" },
      { name: "description", content: "E'lon holati va yangi xabarlar haqidagi bildirishnomalar." },
      { property: "og:title", content: "Bildirishnomalar — UBU Real Estate" },
      { property: "og:description", content: "Hisobingizga oid bildirishnomalar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const tr = useTr();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display mb-6 text-2xl font-bold sm:text-3xl">{tr("Bildirishnomalar", "Уведомления")}</h1>

        {!loading && !user ? (
          <EmptyState
            title={tr("Tizimga kiring", "Войдите в аккаунт")}
            description={tr("Bildirishnomalarni ko'rish uchun hisobingizga kiring.", "Войдите в аккаунт, чтобы видеть уведомления.")}
            action={
              <Button asChild size="sm">
                <Link to="/auth">{tr("Kirish", "Войти")}</Link>
              </Button>
            }
          />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title={tr("Bildirishnomalar yo'q", "Уведомлений пока нет")} description={tr("Yangiliklar shu yerda ko'rinadi.", "Здесь будут появляться новости.")} />
        ) : (
          <ul className="space-y-2">
            {data!.map((item) => (
              <li
                key={item.id}
                className={cn("surface-card p-4", !item.read_at && "border-primary/40")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.body && <p className="text-muted-foreground mt-1 text-sm">{item.body}</p>}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                  {!item.read_at && (
                    <Button variant="ghost" size="sm" onClick={() => markRead.mutate(item.id)}>
                      {tr("O'qildi", "Прочитано")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
