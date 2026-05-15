import type { GeoPoint, GeoValidation, SublimeStore } from "@/types/sublime";

const EARTH_RADIUS_M = 6_371_000;

/** Distance in meters between two coordinates (Haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Validate whether a position is within the store's allowed radius. */
export function validateClockLocation(
  store: SublimeStore | null | undefined,
  position: GeoPoint | null | undefined,
): GeoValidation {
  if (!store) return { ok: false, reason: "no_store" };
  if (store.latitude == null || store.longitude == null) {
    return { ok: false, reason: "no_coords", store };
  }
  if (!position) return { ok: false, reason: "no_position", store };
  const distance = distanceMeters(
    { latitude: store.latitude, longitude: store.longitude },
    position,
  );
  if (distance <= store.radius_meters) {
    return { ok: true, distance, store };
  }
  return { ok: false, reason: "out_of_range", distance, store };
}

/** Promise wrapper around the browser geolocation API. */
export function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      options,
    );
  });
}
