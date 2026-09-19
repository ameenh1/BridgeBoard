// GENERATED FILE — do not edit.
// Written by scripts/generateImageManifest.ts, which runs on `npm run build`.
// Lists the images actually present in public/, so the resolver can fall back
// to text + icon instead of emitting a URL that 404s.

const AVAILABLE = new Set<string>([
  "/default-images/again.webp",
  "/default-images/all-done.webp",
  "/default-images/angry.webp",
  "/default-images/bathroom.webp",
  "/default-images/break.webp",
  "/default-images/dont-like.webp",
  "/default-images/drink.webp",
  "/default-images/eat.webp",
  "/default-images/go.webp",
  "/default-images/happy.webp",
  "/default-images/help.webp",
  "/default-images/hurt.webp",
  "/default-images/i.webp",
  "/default-images/like.webp",
  "/default-images/more.webp",
  "/default-images/need.webp",
  "/default-images/no.webp",
  "/default-images/sad.webp",
  "/default-images/stop.webp",
  "/default-images/tired.webp",
  "/default-images/want.webp",
  "/default-images/yes.webp"
]);

/** True when this public path exists on disk. */
export function imageExists(url: string): boolean {
  return AVAILABLE.has(url);
}

/** Every image available at build time. Useful for diagnostics. */
export function listAvailableImages(): string[] {
  return [...AVAILABLE];
}
