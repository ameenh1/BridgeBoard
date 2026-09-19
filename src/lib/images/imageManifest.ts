// GENERATED FILE — do not edit.
// Written by scripts/generateImageManifest.ts, which runs on `npm run build`.
// Lists the images actually present in public/, so the resolver can fall back
// to text + icon instead of emitting a URL that 404s.

const AVAILABLE = new Set<string>([]);

/** True when this public path exists on disk. */
export function imageExists(url: string): boolean {
  return AVAILABLE.has(url);
}

/** Every image available at build time. Useful for diagnostics. */
export function listAvailableImages(): string[] {
  return [...AVAILABLE];
}
