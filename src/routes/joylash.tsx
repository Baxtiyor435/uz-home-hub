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
import { useTr } from "@/lib/i18n";

export const Route = createFileRoute("/joylash")({
  head: () => ({
    meta: [
      { title: "E'lon joylash — UBU" },
      { name: "description", content: "Uy-joyingiz uchun e'lon joylashtiring va moderatsiyaga yuboring." },
      { property: "og:title", content: "E'lon joylash — UBU" },
      { property: "og:description", content: "E'lon joylashtirish sahifasi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateListingPage,
});

function buildFormSchema(tr: (uz: string, ru: string) => string) {
  return z.object({
    title: z.string().trim().min(10, tr("Sarlavha kamida 10 belgidan iborat bo'lsin", "Заголовок должен содержать минимум 10 символов")).max(120),
    description: z.string().trim().min(20, tr("Tavsif kamida 20 belgidan iborat bo'lsin", "Описание должно содержать минимум 20 символов")).max(3000),
    price: z.number().positive(tr("Narxni kiriting", "Укажите цену")).max(1_000_000_000_000),
    region: z.string().min(1, tr("Hududni tanlang", "Выберите регион")),
    district: z.string().trim().min(2, tr("Tumanni kiriting", "Укажите район")).max(80),
    address: z.string().trim().min(3, tr("Manzilni kiriting", "Укажите адрес")).max(160),
    rooms: z.number().int().min(1).max(30),
    area: z.number().positive(tr("Maydonni kiriting", "Укажите площадь")).max(100000),
  });
}

function CreateListingPage() {
  const { user, isAgent, loading } = useAuth();
  const tr = useTr();
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

      const parsed = buildFormSchema(tr).parse({
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
      toast.success(tr("E'lon e'lon qilindi", "Объявление опубликовано"));
      navigate({ to: "/mening-elonlarim" });
    },
    onError: (error: Error) => {
      if (error.message === "AUTH") {
        toast.error(tr("Avval tizimga kiring", "Сначала войдите в систему"));
        navigate({ to: "/auth" });
        return;
      }
      if (error.message === "AGENT_ONLY") {
        toast.error(tr("Sotuv e'lonini faqat tasdiqlangan agentlar joylashtira oladi", "Объявление о продаже могут размещать только проверенные агенты"));
        return;
      }
      if (error.message === "NO_IMAGES") {
        toast.error(tr("Kamida bitta rasm yuklang", "Загрузите хотя бы одно фото"));
        return;
      }
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]?.message ?? tr("Ma'lumotlarni tekshiring", "Проверьте введённые данные"));
        return;
      }
      toast.error(tr("E'lonni saqlab bo'lmadi", "Не удалось сохранить объявление"));
    },
  });

  if (!loading && !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-xl font-bold">{tr("E'lon joylash uchun tizimga kiring", "Войдите, чтобы разместить объявление")}</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">{tr("Kirish", "Войти")}</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{tr("Yangi e'lon", "Новое объявление")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {tr(
            "E'lon administrator tasdig'idan so'ng saytda ko'rinadi.",
            "Объявление появится на сайте после подтверждения администратором.",
          )}
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
                <Label>{tr("E'lon turi", "Тип объявления")}</Label>
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
                    {tr(
                      "Sotuv e'lonini faqat tasdiqlangan agentlar joylashtira oladi.",
                      "Объявление о продаже могут размещать только проверенные агенты.",
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{tr("Obyekt turi", "Тип объекта")}</Label>
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
              <Label htmlFor="title">{tr("Sarlavha", "Заголовок")}</Label>
              <Input id="title" name="title" maxLength={120} required placeholder={tr("Chilonzorda 3 xonali yorug' kvartira", "Светлая 3-комнатная квартира в Чиланзаре")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tr("Tavsif", "Описание")}</Label>
              <Textarea id="description" name="description" rows={5} maxLength={3000} required />
            </div>
          </section>

          <section className="surface-card grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">{tr("Narx (so'm)", "Цена (сум)")}</Label>
              <Input id="price" name="price" type="number" min={1} required inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>{tr("Hudud", "Регион")}</Label>
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
              <Label htmlFor="district">{tr("Tuman", "Район")}</Label>
              <Input id="district" name="district" maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{tr("Manzil", "Адрес")}</Label>
              <Input id="address" name="address" maxLength={160} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rooms">{tr("Xonalar soni", "Количество комнат")}</Label>
              <Input id="rooms" name="rooms" type="number" min={1} max={30} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">{tr("Maydon (m²)", "Площадь (м²)")}</Label>
              <Input id="area" name="area" type="number" min={1} step="0.1" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor">{tr("Qavat", "Этаж")}</Label>
              <Input id="floor" name="floor" type="number" min={0} max={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_floors">{tr("Umumiy qavatlar", "Всего этажей")}</Label>
              <Input id="total_floors" name="total_floors" type="number" min={0} max={200} />
            </div>
          </section>

          <section className="surface-card p-5">
            <Label className="mb-3 block">{tr("Qulayliklar", "Удобства")}</Label>
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
              {tr(`Rasmlar (maksimal ${maxImages} ta)`, `Фото (максимум ${maxImages})`)}
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
                      aria-label={tr("O'chirish", "Удалить")}
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
            {tr("Moderatsiyaga yuborish", "Отправить на модерацию")}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
