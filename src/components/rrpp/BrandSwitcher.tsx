import { RRPP_BRANDS, type RRPPBrand } from "@/hooks/useRRPPBrand";

interface Props {
  value: RRPPBrand;
  onChange: (b: RRPPBrand) => void;
}

export function BrandSwitcher({ value, onChange }: Props) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-muted">
      {RRPP_BRANDS.map((b) => {
        const active = value === b.value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={[
              "px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50",
            ].join(" ")}
          >
            {b.short}
          </button>
        );
      })}
    </div>
  );
}
