import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PROPERTY_BUCKET, uploadImage } from "@/lib/storage";
import {
  DEAL_TYPE_LABELS,
  FEATURE_OPTIONS,
  PROPERTY_KIND_LABELS,
  REGIONS,
  type DealType,
  type PropertyKind,
} from "@/lib/uz";

export const Route = createFileRoute("/joylash")({
  head: () => ({
    meta: [
      { title: "E'lon joylash — UBU Real Estate" },
      { name: "description", content: "Uy-joyingiz uchun e'lon joylashtiring va moderatsiyaga yuboring." },
      { property: "og:title", content: "E'lon joylash — UBU Real Estate" },
      { property: "og:description", content: "E'lon joylashtirish sahifasi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateListingPage,
});

const formSchema = z.object({
  title: z.string().trim().min(10, "Sarlavha kamida 10 belgidan iborat bo'lsin").max(120),
  description: z.string().trim().min(20, "Tavsif kamida 20 belgidan iborat bo'lsin").max(3000),
  price: z.number().positive("Narxni kiriting").max(1_000_000_000_000),
  region: z.string().min(1, "Hududni tanlang"),
  district: z.string().trim().min(2, "Tumanni kiriting").max(80),
  address: z.string().trim().min(3, "Manzilni kiriting").max(160),
  rooms: z.number().int().min(1).max(30),
  area: z.number().positive("Maydonni kiriting").max(100000),
});

function CreateListingPage() {
  const { user, isAgent, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dealType, setDealType] = useState<DealType>("rent");
  const [kind, setKind] = useState<PropertyKind>("apartment");
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [features, setFeatures] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      return data ?? [];
    },
  });

  const maxImages = Number(
    (settings?.find((row) => row.key === "max_images")?.value as { count?: number } | undefined)
      ?.count ?? 10,
  );

  const submit = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!user) throw new Error("AUTH");
      if (dealType === "sale" && !isAgent) throw new Error("AGENT_ONLY");
      if (files.length === 0) throw new Error("NO_IMAGES");

      const parsed = formSchema.parse({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        price: Number(formData.get("price")),
        region,
        district: String(formData.get("district") ?? ""),
        address: String(formData.get("address") ?? ""),
        rooms: Number(formData.get("rooms")),
        area: Number(formData.get("area")),
      });

      const floorRaw = formData.get("floor");
      const totalFloorsRaw = formData.get("total_floors");

      const images: string[] = [];
      for (const file of files.slice(0, maxImages)) {
        images.push(await uploadImage(PROPERTY_BUCKET, user.id, file));
      }

      const { data, error } = await supabase
        .from("properties")
        .insert({
          owner_id: user.id,
          title: parsed.title,
          description: parsed.description,
          deal_type: dealType,
          kind,
          price: parsed.price,
          region: parsed.region,
          district: parsed.district,
          address: parsed.address,
          rooms: parsed.rooms,
          area: parsed.area,
          floor: floorRaw ? Number(floorRaw) : null,
          total_floors: totalFloorsRaw ? Number(totalFloorsRaw) : null,
          images,
          features,
          status: "approved",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-properties", user?.id] });
      toast.success("E'lon e'lon qilindi");
      navigate({ to: "/mening-elonlarim" });
    },
    onError: (error: Error) => {
      if (error.message === "AUTH") {
        toast.error("Avval tizimga kiring");
        navigate({ to: "/auth" });
        return;
      }
      if (error.message === "AGENT_ONLY") {
        toast.error("Sotuv e'lonini faqat tasdiqlangan agentlar joylashtira oladi");
        return;
      }
      if (error.message === "NO_IMAGES") {
        toast.error("Kamida bitta rasm yuklang");
        return;
      }
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]?.message ?? "Ma'lumotlarni tekshiring");
        return;
      }
      toast.error("E'lonni saqlab bo'lmadi");
    },
  });

  if (!loading && !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-xl font-bold">E'lon joylash uchun tizimga kiring</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">Kirish</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Yangi e'lon</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          E'lon administrator tasdig'idan so'ng saytda ko'rinadi.
        </p>

        <form
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate(new FormData(event.currentTarget));
          }}
        >
          <section className="surface-card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>E'lon turi</Label>
                <Select value={dealType} onValueChange={(value) => setDealType(value as DealType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dealType === "sale" && !isAgent && (
                  <p className="text-destructive text-xs">
                    Sotuv e'lonini faqat tasdiqlangan agentlar joylashtira oladi.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Obyekt turi</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as PropertyKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Sarlavha</Label>
              <Input id="title" name="title" maxLength={120} required placeholder="Chilonzorda 3 xonali yorug' kvartira" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Tavsif</Label>
              <Textarea id="description" name="description" rows={5} maxLength={3000} required />
            </div>
          </section>

          <section className="surface-card grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Narx (so'm)</Label>
              <Input id="price" name="price" type="number" min={1} required inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Hudud</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">Tuman</Label>
              <Input id="district" name="district" maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Manzil</Label>
              <Input id="address" name="address" maxLength={160} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rooms">Xonalar soni</Label>
              <Input id="rooms" name="rooms" type="number" min={1} max={30} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Maydon (m²)</Label>
              <Input id="area" name="area" type="number" min={1} step="0.1" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor">Qavat</Label>
              <Input id="floor" name="floor" type="number" min={0} max={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_floors">Umumiy qavatlar</Label>
              <Input id="total_floors" name="total_floors" type="number" min={0} max={200} />
            </div>
          </section>

          <section className="surface-card p-5">
            <Label className="mb-3 block">Qulayliklar</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURE_OPTIONS.map((feature) => (
                <label key={feature} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={features.includes(feature)}
                    onCheckedChange={(checked) =>
                      setFeatures((prev) =>
                        checked ? [...prev, feature] : prev.filter((item) => item !== feature),
                      )
                    }
                  />
                  {feature}
                </label>
              ))}
            </div>
          </section>

          <section className="surface-card p-5">
            <Label htmlFor="images" className="mb-2 block">
              Rasmlar (maksimal {maxImages} ta)
            </Label>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, maxImages))}
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {files.map((file, index) => (
                  <li key={file.name} className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="O'chirish"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Moderatsiyaga yuborish
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
