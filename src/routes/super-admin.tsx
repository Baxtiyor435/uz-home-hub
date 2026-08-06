import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatPhone } from "@/lib/format";
import { listPlatformUsers, setUserBlocked, setUserRole } from "@/lib/staff.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/uz";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super admin — UBU Real Estate" },
      { name: "description", content: "Foydalanuvchilar, rollar va bloklashni boshqarish paneli." },
      { property: "og:title", content: "Super admin — UBU Real Estate" },
      { property: "og:description", content: "Foydalanuvchilar va rollarni boshqarish." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminPage,
});

const MANAGED_ROLES: AppRole[] = ["agent", "admin", "super_admin"];

function SuperAdminPage() {
  const { isSuperAdmin, loading, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["super-admin", "users"],
    enabled: isSuperAdmin,
    queryFn: () => listPlatformUsers({ data: undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["super-admin", "users"] });

  const roleAction = useMutation({
    mutationFn: (input: { userId: string; role: "agent" | "admin" | "super_admin"; grant: boolean }) =>
      setUserRole({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success("Rol yangilandi");
    },
    onError: () => toast.error("Rolni o'zgartirib bo'lmadi"),
  });

  const blockAction = useMutation({
    mutationFn: (input: { userId: string; blocked: boolean }) => setUserBlocked({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success("Holat yangilandi");
    },
    onError: () => toast.error("Amalni bajarib bo'lmadi"),
  });

  if (!loading && !isSuperAdmin) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16">
          <EmptyState
            title="Ruxsat yo'q"
            description="Bu sahifa faqat bosh administrator uchun."
            action={
              <Button asChild size="sm">
                <Link to="/profil">Profilga qaytish</Link>
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Crown className="text-primary h-6 w-6" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Super admin panel</h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ShieldCheck className="mr-1 h-4 w-4" />
              Moderatsiya paneli
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          {(users?.length ?? 0) === 0 ? (
            <EmptyState title="Foydalanuvchilar topilmadi" />
          ) : (
            users!.map((row) => (
              <article key={row.id} className="surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {row.full_name || "Foydalanuvchi"}
                      {row.id === user?.id && (
                        <span className="text-muted-foreground ml-2 text-xs">(siz)</span>
                      )}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      {formatPhone(row.phone)} · {formatDate(row.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.roles.length === 0 && <Badge variant="secondary">Foydalanuvchi</Badge>}
                      {row.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {ROLE_LABELS[role as AppRole]}
                        </Badge>
                      ))}
                      {row.is_blocked && <Badge variant="outline">Bloklangan</Badge>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blockAction.isPending || row.id === user?.id}
                    onClick={() => blockAction.mutate({ userId: row.id, blocked: !row.is_blocked })}
                  >
                    {row.is_blocked ? "Blokdan chiqarish" : "Bloklash"}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {MANAGED_ROLES.map((role) => {
                    const has = row.roles.includes(role);
                    return (
                      <Button
                        key={role}
                        size="sm"
                        variant={has ? "secondary" : "outline"}
                        disabled={roleAction.isPending}
                        onClick={() =>
                          roleAction.mutate({
                            userId: row.id,
                            role: role as "agent" | "admin" | "super_admin",
                            grant: !has,
                          })
                        }
                      >
                        <UserCog className="mr-1 h-4 w-4" />
                        {has ? `${ROLE_LABELS[role]}ni olib tashlash` : `${ROLE_LABELS[role]} qilish`}
                      </Button>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
