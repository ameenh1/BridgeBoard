/*
 * Generates src/lib/images/imageManifest.ts from what is actually in public/.
 *
 * Runs as `prebuild`, so the manifest is always current at build time. We do
 * this at build rather than checking the filesystem at request time because
 * `public/` is not reliably present inside a serverless bundle — a runtime
 * check would report "missing" for images the CDN is happily serving.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const IMAGE_DIRS = ["default-images", "demo-photos"];
const OUT = path.join("src", "lib", "images", "imageManifest.ts");

// Extension allowlist, so README notes and .gitkeep placeholders in these
// directories are not counted as available artwork.
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"]);

function listImages(): string[] {
  const found: string[] = [];

  for (const dir of IMAGE_DIRS) {
    const abs = path.join("public", dir);
    if (!fs.existsSync(abs)) continue;

    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      found.push(`/${dir}/${entry.name}`);
    }
  }

  return found.sort();
}

const images = listImages();

const body = `// GENERATED FILE — do not edit.
// Written by scripts/generateImageManifest.ts, which runs on \`npm run build\`.
// Lists the images actually present in public/, so the resolver can fall back
// to text + icon instead of emitting a URL that 404s.

const AVAILABLE = new Set<string>(${JSON.stringify(images, null, 2)});

/** True when this public path exists on disk. */
export function imageExists(url: string): boolean {
  return AVAILABLE.has(url);
}

/** Every image available at build time. Useful for diagnostics. */
export function listAvailableImages(): string[] {
  return [...AVAILABLE];
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, "utf8");

console.log(`[images] manifest written: ${images.length} image(s)`);
for (const image of images) console.log(`         ${image}`);
