import { createContext, useContext, type ReactNode } from "react";

export type MerchBrand = "sublime" | "basico";

export interface MerchBrandConfig {
  brand: MerchBrand;
  /** Nombre corto de la marca, usado en etiquetas visibles. */
  label: string;
  /** Título del módulo. */
  title: string;
  subtitle: string;
}

const SUBLIME_CONFIG: MerchBrandConfig = {
  brand: "sublime",
  label: "SUBLIME",
  title: "Sublime Mercancía",
  subtitle: "Control de productos comprados, envíos, cajas y mercancía disponible.",
};

export const BASICO_MERCH_CONFIG: MerchBrandConfig = {
  brand: "basico",
  label: "BASICO",
  title: "Mercancía en Tránsito",
  subtitle: "Control de productos comprados, envíos, cajas y mercancía disponible.",
};

const MerchBrandContext = createContext<MerchBrandConfig>(SUBLIME_CONFIG);

export function MerchBrandProvider({
  config = SUBLIME_CONFIG,
  children,
}: {
  config?: MerchBrandConfig;
  children: ReactNode;
}) {
  return <MerchBrandContext.Provider value={config}>{children}</MerchBrandContext.Provider>;
}

export function useMerchBrandConfig(): MerchBrandConfig {
  return useContext(MerchBrandContext);
}

export function useMerchBrand(): MerchBrand {
  return useContext(MerchBrandContext).brand;
}
