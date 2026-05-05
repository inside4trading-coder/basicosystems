import { useEffect, useState } from "react";

const KEY = "dashboard_blur_sales";
const EVENT = "dashboard_blur_sales_changed";

export function getBlurSales(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setBlurSales(v: boolean) {
  localStorage.setItem(KEY, v ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function useBlurSales(): boolean {
  const [v, setV] = useState<boolean>(getBlurSales());
  useEffect(() => {
    const handler = () => setV(getBlurSales());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return v;
}
