/**
 * Recupera el mensaje de error real de una Edge Function.
 *
 * `supabase.functions.invoke` convierte cualquier respuesta no-2xx en un `FunctionsHttpError`
 * genérico ("Edge Function returned a non-2xx status code") y deja `data` en null, así que el
 * motivo que devolvió la función —"saldo insuficiente en OpenRouter", "límite alcanzado"— nunca
 * llega al usuario. La respuesta original queda accesible en `error.context`.
 */
export async function readEdgeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;

  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      if (body?.error) return String(body.error);
    } catch {
      // El cuerpo no era JSON — caemos al mensaje genérico.
    }
  }

  return (error as { message?: string })?.message ?? "La generación falló.";
}

/**
 * Traduce un error de PostgREST a algo accionable.
 *
 * `PGRST205` significa que la tabla no existe: pasa cuando la migración del módulo todavía no
 * se aplicó. Sin este mensaje la pantalla queda vacía o colgada y parece que el módulo
 * simplemente no tiene datos, que es engañoso.
 */
export function describeEstudioLoadError(error: { code?: string } | null, fallback: string): string {
  if (error?.code === "PGRST205") {
    return "El módulo no está instalado en la base de datos todavía (falta aplicar su migración).";
  }
  return fallback;
}
