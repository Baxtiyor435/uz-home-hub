import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTr } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/suhbatlar/$id")({
  head: () => ({
    meta: [
      { title: "Suhbat — UBU" },
      { name: "description", content: "E'lon egasi bilan real vaqtdagi yozishma." },
      { property: "og:title", content: "Suhbat — UBU" },
      { property: "og:description", content: "Real vaqtdagi yozishma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversationPage,
});

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function ConversationPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const tr = useTr();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["messages", id] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!user || !body) throw new Error("EMPTY");
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: user.id, body: body.slice(0, 2000) });
      if (error) throw error;
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: (error: Error) => {
      if (error.message !== "EMPTY") toast.error(tr("Xabar yuborilmadi", "Не удалось отправить сообщение"));
    },
  });

  if (!loading && !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16">
          <EmptyState
            title={tr("Tizimga kiring", "Войдите в аккаунт")}
            description={tr("Yozishmani ochish uchun hisobingizga kiring.", "Войдите в аккаунт, чтобы открыть переписку.")}
            action={
              <Button asChild size="sm">
                <Link to="/auth">{tr("Kirish", "Войти")}</Link>
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-2xl flex-col px-4 py-6">
        <Link to="/suhbatlar" className="text-muted-foreground mb-3 text-sm hover:underline">
          ← {tr("Barcha suhbatlar", "Все сообщения")}
        </Link>

        <ul className="flex-1 space-y-2 overflow-y-auto pr-1">
          {(messages ?? []).map((message) => {
            const own = message.sender_id === user?.id;
            return (
              <li key={message.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    own ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p className={cn("mt-1 text-[10px]", own ? "opacity-70" : "text-muted-foreground")}>
                    {formatRelativeTime(message.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
          <div ref={bottomRef} />
        </ul>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send.mutate();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={tr("Xabar yozing...", "Напишите сообщение...")}
            maxLength={2000}
            aria-label={tr("Xabar matni", "Текст сообщения")}
          />
          <Button type="submit" size="icon" disabled={send.isPending || !draft.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">{tr("Yuborish", "Отправить")}</span>
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
