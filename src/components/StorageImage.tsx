import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";

import { getSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type StorageImageProps = {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
};

/** Renders an image stored in a private bucket via a temporary signed URL. */
export function StorageImage({ bucket, path, alt, className }: StorageImageProps) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 1000 * 60 * 60,
    queryFn: () => getSignedUrl(bucket, path!),
  });

  if (!path || (!url && !isLoading)) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        aria-label="Rasm mavjud emas"
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  if (!url) {
    return <div className={cn("animate-pulse bg-muted", className)} aria-hidden="true" />;
  }

  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
