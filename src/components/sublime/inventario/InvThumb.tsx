import { useEffect, useState } from "react";
import { Shirt } from "lucide-react";
import { resolvePhotoUrl } from "@/lib/sublimeMerch";

export function InvThumb({ url, alt }: { url: string | null; alt: string }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let alive = true;
    if (!url) {
      setSrc("");
      return;
    }
    resolvePhotoUrl(url).then((u) => {
      if (alive) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  if (!src) {
    return (
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Shirt className="h-4 w-4 text-muted-foreground/60" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className="h-10 w-10 rounded-lg object-cover shrink-0" />;
}
