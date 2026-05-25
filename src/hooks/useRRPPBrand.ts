import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type RRPPBrand = "basico_ve" | "sublime" | "basico_es";

export const RRPP_BRANDS: { value: RRPPBrand; label: string; short: string }[] = [
  { value: "basico_ve", label: "Básico Venezuela", short: "Básico VE" },
  { value: "sublime",   label: "Sublime",          short: "Sublime"  },
  { value: "basico_es", label: "Básico España / Europa", short: "Básico ES" },
];

export const RRPP_BRAND_LABELS: Record<RRPPBrand, string> = {
  basico_ve: "Básico Venezuela",
  sublime: "Sublime",
  basico_es: "Básico España / Europa",
};

const STORAGE_KEY = "rrpp_active_brand_v1";

function isBrand(v: string | null): v is RRPPBrand {
  return v === "basico_ve" || v === "sublime" || v === "basico_es";
}

/** Returns the active brand from URL (?brand=) or localStorage, defaulting to basico_ve. */
export function useRRPPBrand(): [RRPPBrand, (b: RRPPBrand) => void] {
  const [params, setParams] = useSearchParams();
  const urlBrand = params.get("brand");

  const initial: RRPPBrand = (() => {
    if (isBrand(urlBrand)) return urlBrand;
    try {
      const ls = localStorage.getItem(STORAGE_KEY);
      if (isBrand(ls)) return ls;
    } catch { /* ignore */ }
    return "basico_ve";
  })();

  const [brand, setBrandState] = useState<RRPPBrand>(initial);

  // Sync URL → state on external changes
  useEffect(() => {
    if (isBrand(urlBrand) && urlBrand !== brand) setBrandState(urlBrand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBrand]);

  const setBrand = useCallback((b: RRPPBrand) => {
    setBrandState(b);
    try { localStorage.setItem(STORAGE_KEY, b); } catch { /* ignore */ }
    const next = new URLSearchParams(params);
    next.set("brand", b);
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Make sure URL is in sync at mount
  useEffect(() => {
    if (!isBrand(urlBrand)) {
      const next = new URLSearchParams(params);
      next.set("brand", brand);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [brand, setBrand];
}
