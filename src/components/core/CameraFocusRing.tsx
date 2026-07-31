interface Props {
  x: number;
  y: number;
}

/** Small animated focus ring shown at the tapped point of the camera preview. */
export function FocusRing({ x, y }: Props) {
  return (
    <span
      className="pointer-events-none absolute z-20 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/90 animate-[focus-ring_0.8s_ease-out_forwards]"
      style={{ left: x, top: y }}
    >
      <span className="absolute inset-2 rounded-full border border-primary/60" />
    </span>
  );
}
