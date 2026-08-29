type BrandMarkVariant = "positive" | "negative" | "onPrimary" | "outline";

interface BrandMarkProps {
  variant?: BrandMarkVariant;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lockup [B] SYSTEMS — composición tipográfica en Chakra Petch, no un SVG.
 *
 * Todas las proporciones van en `em` para que escale con el `font-size` que
 * le dé el elemento contenedor. Los dos valores de la B (tamaño y desplazamiento
 * vertical) salen de las métricas reales de Chakra Petch y centran ópticamente
 * la letra entre los corchetes: no redondear.
 *
 * Espacio seguro: la altura del corchete por los cuatro lados. Tamaño mínimo
 * recomendado 150px de ancho aproximado; por debajo de eso, usar solo el
 * isotipo `[B]` (omitiendo el `<span>` de "SYSTEMS").
 */
export default function BrandMark({ variant = "positive", className, style }: BrandMarkProps) {
  const isLight = variant === "negative" || variant === "onPrimary";
  const useStroke = variant === "positive";
  const bracketColor = variant === "outline" ? "currentColor" : isLight ? "#FFFFFF" : "#0A0D12";
  const textColor = variant === "outline" ? "currentColor" : isLight ? "#FFFFFF" : "#0A0D12";

  const bracketStyle: React.CSSProperties = {
    fontWeight: 500,
    color: bracketColor,
    WebkitTextStroke: useStroke ? "0.018em #39424D" : undefined,
  };

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.34em",
        fontFamily: '"Chakra Petch", system-ui, sans-serif',
        fontWeight: 700,
        lineHeight: 0.8,
        letterSpacing: "-0.01em",
        color: textColor,
        whiteSpace: "nowrap",
        ...style,
      }}
      aria-label="[B] SYSTEMS"
    >
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        <span style={bracketStyle}>[</span>
        <span style={{ fontSize: "0.85em", position: "relative", top: "-0.061em" }}>B</span>
        <span style={bracketStyle}>]</span>
      </span>
      <span
        style={{
          fontSize: "0.567em",
          letterSpacing: "0.06em",
          position: "relative",
          top: "0.06em",
        }}
      >
        SYSTEMS
      </span>
    </span>
  );
}
