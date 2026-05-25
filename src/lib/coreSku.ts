export function nextSku(prefix: string, digits: number, lastNumber: number): string {
  const next = (lastNumber ?? 0) + 1;
  return `${prefix}${String(next).padStart(digits, "0")}`;
}

export function previewSku(prefix: string, digits: number, lastNumber: number): string {
  return nextSku(prefix || "CORE", Math.max(1, digits || 6), lastNumber || 0);
}
