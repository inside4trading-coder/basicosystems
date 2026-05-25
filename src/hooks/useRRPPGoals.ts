import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RRPPBrand } from "./useRRPPBrand";

const db = supabase as any;

export interface BrandGoals {
  captaciones: number;
  activaciones: number;
  colaboraciones: number;
}

const DEFAULTS: Record<RRPPBrand, BrandGoals> = {
  basico_ve: { captaciones: 10, activaciones: 8, colaboraciones: 7 },
  sublime:   { captaciones:  6, activaciones: 4, colaboraciones: 3 },
  basico_es: { captaciones: 10, activaciones: 8, colaboraciones: 7 },
};

export function useRRPPGoals(brand: RRPPBrand, year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const [goals, setGoals] = useState<BrandGoals>(DEFAULTS[brand]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("rrpp_brand_goals")
      .select("captaciones,activaciones,colaboraciones")
      .eq("brand", brand)
      .eq("year", y)
      .eq("month", m)
      .maybeSingle();
    setGoals(data ?? DEFAULTS[brand]);
    setLoading(false);
  }, [brand, y, m]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: BrandGoals) => {
    const payload = { brand, year: y, month: m, ...next };
    const { error } = await db
      .from("rrpp_brand_goals")
      .upsert(payload, { onConflict: "brand,year,month" });
    if (error) throw error;
    setGoals(next);
  }, [brand, y, m]);

  return { goals, loading, save, reload: load };
}
