import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { TOP_PLANS, type TopPlanId } from "@/lib/promotion";
import { promoteProperty } from "@/lib/promotion.functions";

export function PromoteDialog({ propertyId, userId }: { propertyId: string; userId?: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<TopPlanId>("d7");

  const promote = useMutation({
    mutationFn: () => promoteProperty({ data: { propertyId, planId } }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-properties", userId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success(t("top.success"));
    },
    onError: (error: Error) => toast.error(error.message || t("top.error")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Flame className="h-4 w-4" aria-hidden="true" />
          {t("top.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("top.title")}</DialogTitle>
          <DialogDescription>{t("top.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {TOP_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanId(plan.id)}
              className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                planId === plan.id ? "border-primary bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span className="text-sm font-semibold">
                {plan.days} {t("top.days")}
              </span>
              <span className="text-primary text-sm font-bold">{formatPrice(plan.price)}</span>
            </button>
          ))}
        </div>

        <Button className="w-full" disabled={promote.isPending} onClick={() => promote.mutate()}>
          {promote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("top.pay")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
