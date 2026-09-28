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
import { useTr } from "@/lib/i18n";
import {
  listPlatformUsers,
  resetUserDevice,
  setUserBlocked,
  setUserRole,
} from "@/lib/staff.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/uz";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super admin — UBU" },
      { name: "description", content: "Foydalanuvchilar, rollar va bloklashni boshqarish paneli." },
      { property: "og:title", content: "Super admin — UBU" },
      { property: "og:description", content: "Foydalanuvchilar va rollarni boshqarish." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminPage,
});

const MANAGED_ROLES: AppRole[] = ["agent", "admin", "super_admin"];

function SuperAdminPage() {
  const { isSuperAdmin, loading, user } = useAuth();
  const tr = useTr();
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
      toast.success(tr("Rol yangilandi", "Роль обновлена"));
    },
    onError: () => toast.error(tr("Rolni o'zgartirib bo'lmadi", "Не удалось изменить роль")),
  });

  const blockAction = useMutation({
    mutationFn: (input: { userId: string; blocked: boolean }) => setUserBlocked({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success(tr("Holat yangilandi", "Статус обновлён"));
    },
    onError: () => toast.error(tr("Amalni bajarib bo'lmadi", "Не удалось выполнить действие")),
  });

  const deviceAction = useMutation({
    mutationFn: (input: { userId: string }) => resetUserDevice({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success(tr("Qurilma bog'lanishi bekor qilindi", "Привязка устройства сброшена"));
    },
    onError: () => toast.error(tr("Qurilmani tiklab bo'lmadi", "Не удалось сбросить устройство")),
  });

  if (!loading && !isSuperAdmin) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16">
          <EmptyState
            title={tr("Ruxsat yo'q", "Нет доступа")}
            description={tr("Bu sahifa faqat bosh administrator uchun.", "Эта страница только для главного администратора.")}
            action={
              <Button asChild size="sm">
                <Link to="/profil">{tr("Profilga qaytish", "Вернуться в профиль")}</Link>
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
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{tr("Super admin panel", "Панель супер-админа")}</h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ShieldCheck className="mr-1 h-4 w-4" />
              {tr("Moderatsiya paneli", "Панель модерации")}
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          {(users?.length ?? 0) === 0 ? (
            <EmptyState title={tr("Foydalanuvchilar topilmadi", "Пользователи не найдены")} />
          ) : (
            users!.map((row) => (
              <article key={row.id} className="surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {row.full_name || tr("Foydalanuvchi", "Пользователь")}
                      {row.id === user?.id && (
                        <span className="text-muted-foreground ml-2 text-xs">{tr("(siz)", "(вы)")}</span>
                      )}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      {formatPhone(row.phone)} · {formatDate(row.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.roles.length === 0 && <Badge variant="secondary">{tr("Foydalanuvchi", "Пользователь")}</Badge>}
                      {row.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {ROLE_LABELS[role as AppRole]}
                        </Badge>
                      ))}
                      {row.is_blocked && <Badge variant="outline">{tr("Bloklangan", "Заблокирован")}</Badge>}
                      {row.device_id && <Badge variant="outline">{tr("Qurilmaga bog'langan", "Привязан к устройству")}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deviceAction.isPending || !row.device_id}
                    onClick={() => deviceAction.mutate({ userId: row.id })}
                  >
                    {tr("Qurilmani tiklash", "Сбросить устройство")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blockAction.isPending || row.id === user?.id}
                    onClick={() => blockAction.mutate({ userId: row.id, blocked: !row.is_blocked })}
                  >
                    {row.is_blocked ? tr("Blokdan chiqarish", "Разблокировать") : tr("Bloklash", "Заблокировать")}
                  </Button>
                  </div>
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
                        {has ? `${ROLE_LABELS[role]}${tr("ni olib tashlash", " — снять")}` : `${ROLE_LABELS[role]}${tr(" qilish", " — назначить")}`}
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
