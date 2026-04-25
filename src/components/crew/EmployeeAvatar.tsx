import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  photoUrl: string | null | undefined;
  firstName: string;
  lastName: string;
  className?: string;
  fallbackClassName?: string;
}

export function EmployeeAvatar({ photoUrl, firstName, lastName, className, fallbackClassName }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoUrl) { setResolved(null); return; }
    if (photoUrl.startsWith("http") || photoUrl.startsWith("blob:") || photoUrl.startsWith("data:")) {
      setResolved(photoUrl);
      return;
    }
    supabase.storage.from("crew-documents").createSignedUrl(photoUrl, 3600)
      .then(({ data }) => { if (!cancelled) setResolved(data?.signedUrl ?? null); })
      .catch(() => { if (!cancelled) setResolved(null); });
    return () => { cancelled = true; };
  }, [photoUrl]);

  return (
    <Avatar className={cn("h-12 w-12 shrink-0", className)}>
      {resolved && <AvatarImage src={resolved} />}
      <AvatarFallback className={cn("bg-primary/10 text-primary font-bold text-sm", fallbackClassName)}>
        {firstName[0]}{lastName[0]}
      </AvatarFallback>
    </Avatar>
  );
}
