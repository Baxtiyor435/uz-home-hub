import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPlatformToZero } from "@/lib/super-admin-setup.functions";

export const Route = createFileRoute("/nolga")({
  head: () => ({ meta: [{ title: "Ilovani tozalash" }, { name: "robots", content: "noindex" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await resetPlatformToZero({ data: { confirm: "NOLGA" } });
      setDone(true);
      toast.success("Ilova tozalandi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tozalab bo'lmadi");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Ilovani 0 ga tushirish</h1>
      <p className="mt-2 text-sm text-muted-foreground">Barcha foydalanuvchilar va e'lonlar o'chadi. Qaytarib bo'lmaydi.</p>
      {done ? (
        <p className="mt-6 text-sm">Tozalandi. Endi /super-kirish sahifasida yangi parol yarating.</p>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="NOLGA" />
          <Button type="submit" variant="destructive" disabled={pending || confirm !== "NOLGA"}>Tozalash</Button>
        </form>
      )}
    </div>
  );
}
