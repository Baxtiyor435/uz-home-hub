import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { StorageImage } from "@/components/StorageImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  listPendingPayments,
  moderateAgentApplication,
  moderateListing,
  reviewPremiumPayment,
} from "@/lib/admin.functions";
import { formatDate, formatPrice } from "@/lib/format";
import { PROPERTY_BUCKET } from "@/lib/storage";
import { DEAL_TYPE_LABELS } from "@/lib/uz";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — UBU Real Estate" },
      { name: "description", content: "E'lonlar va agentlik arizalarini moderatsiya qilish paneli." },
      { property: "og:title", content: "Admin panel — UBU Real Estate" },
      { property: "og:description", content: "Moderatsiya paneli." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isStaff, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingListings } = useQuery({
    queryKey: ["admin", "listings"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, price, currency, deal_type, region, district, images, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingApplications } = useQuery({
    queryKey: ["admin", "applications"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_applications")
        .select("id, full_name, agency_name, phone, experience_years, message, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ["admin", "payments"],
    enabled: isStaff,
    queryFn: () => listPendingPayments({ data: undefined }),
  });

  const paymentAction = useMutation({
    mutationFn: (input: { paymentId: string; approve: boolean; reason?: string }) =>
      reviewPremiumPayment({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      toast.success("To'lov holati yangilandi");
    },
    onError: () => toast.error("Amalni bajarib bo'lmadi"),
  });


  const listingAction = useMutation({
    mutationFn: (input: { propertyId: string; approve: boolean; reason?: string }) =>
      moderateListing({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
      toast.success("E'lon holati yangilandi");
    },
    onError: () => toast.error("Amalni bajarib bo'lmadi"),
  });

  const applicationAction = useMutation({
    mutationFn: (input: { applicationId: string; approve: boolean; reason?: string }) =>
      moderateAgentApplication({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      toast.success("Ariza holati yangilandi");
    },
    onError: () => toast.error("Amalni bajarib bo'lmadi"),
  });

  if (!loading && !isStaff) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16">
          <EmptyState
            title="Ruxsat yo'q"
            description="Bu sahifa faqat administratorlar uchun."
            action={
              <Button asChild size="sm">
                <Link to="/">Bosh sahifa</Link>
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
        <h1 className="font-display mb-6 text-2xl font-bold sm:text-3xl">Admin panel</h1>

        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">
              E'lonlar ({pendingListings?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="applications">
              Agent arizalari ({pendingApplications?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="payments">
              To'lovlar ({pendingPayments?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4 space-y-3">
            {(pendingListings?.length ?? 0) === 0 ? (
              <EmptyState title="Tasdiqlash kutayotgan e'lon yo'q" />
            ) : (
              pendingListings!.map((listing) => (
                <article key={listing.id} className="surface-card flex gap-4 p-3">
                  <StorageImage
                    bucket={PROPERTY_BUCKET}
                    path={listing.images[0]}
                    alt={listing.title}
                    className="h-24 w-32 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline">{DEAL_TYPE_LABELS[listing.deal_type]}</Badge>
                    <h2 className="mt-1 line-clamp-1 text-sm font-semibold">{listing.title}</h2>
                    <p className="text-primary text-sm font-semibold">
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {listing.region}, {listing.district} · {formatDate(listing.created_at)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={listingAction.isPending}
                        onClick={() =>
                          listingAction.mutate({ propertyId: listing.id, approve: true })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Tasdiqlash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={listingAction.isPending}
                        onClick={() => {
                          const reason = window.prompt("Rad etish sababi:") ?? "";
                          if (!reason.trim()) return;
                          listingAction.mutate({
                            propertyId: listing.id,
                            approve: false,
                            reason: reason.trim(),
                          });
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Rad etish
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="applications" className="mt-4 space-y-3">
            {(pendingApplications?.length ?? 0) === 0 ? (
              <EmptyState title="Yangi agentlik arizasi yo'q" />
            ) : (
              pendingApplications!.map((application) => (
                <article key={application.id} className="surface-card p-4">
                  <h2 className="text-sm font-semibold">{application.full_name}</h2>
                  <p className="text-muted-foreground text-xs">
                    {application.agency_name} · {application.experience_years} yil tajriba
                  </p>
                  {application.message && (
                    <p className="text-muted-foreground mt-2 text-sm">{application.message}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={applicationAction.isPending}
                      onClick={() =>
                        applicationAction.mutate({ applicationId: application.id, approve: true })
                      }
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Tasdiqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={applicationAction.isPending}
                      onClick={() => {
                        const reason = window.prompt("Rad etish sababi:") ?? "";
                        if (!reason.trim()) return;
                        applicationAction.mutate({
                          applicationId: application.id,
                          approve: false,
                          reason: reason.trim(),
                        });
                      }}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Rad etish
                    </Button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-3">
            {(pendingPayments?.length ?? 0) === 0 ? (
              <EmptyState title="Tekshirish kutayotgan to'lov yo'q" />
            ) : (
              pendingPayments!.map((payment) => (
                <article key={payment.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {payment.full_name ?? "Foydalanuvchi"} · {payment.phone ?? "—"}
                    </h2>
                    <Badge variant="outline">{payment.months} oy</Badge>
                  </div>
                  <p className="text-primary mt-1 text-sm font-semibold">
                    {formatPrice(payment.amount, payment.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs">{formatDate(payment.created_at)}</p>
                  {payment.payer_note && (
                    <p className="text-muted-foreground mt-2 text-sm">Izoh: {payment.payer_note}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={paymentAction.isPending}
                      onClick={() => paymentAction.mutate({ paymentId: payment.id, approve: true })}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Tasdiqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={paymentAction.isPending}
                      onClick={() => {
                        const reason = window.prompt("Rad etish sababi:") ?? "";
                        if (!reason.trim()) return;
                        paymentAction.mutate({
                          paymentId: payment.id,
                          approve: false,
                          reason: reason.trim(),
                        });
                      }}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Rad etish
                    </Button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
