import { supabase } from "@/integrations/supabase/client";

/**
 * Shim temporal para las tablas `estudio_*`.
 *
 * Todavía no existen en `src/integrations/supabase/types.ts` porque los tipos no se han
 * regenerado desde que se creó la migración del módulo. Sin este cast, cada `.from("estudio_…")`
 * falla el typecheck con TS2769 (el nombre de tabla no está en la unión generada).
 *
 * Al aplicar la migración y regenerar los tipos, sustituir `estudioDb` por `supabase` y borrar
 * este archivo — así el módulo recupera seguridad de tipos real.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const estudioDb = supabase as any;
