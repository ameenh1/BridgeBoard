/**
 * One-off importer: re-encodes the AAC artwork from the frontend branch into
 * optimized WebP under public/default-images, and copies the decorative
 * login/setup art into public/brand.
 *
 * The frontend shipped ~17 MB of unoptimized PNGs (several over 1 MB each)
 * behind filenames with spaces, parentheses and a misspelled folder. None of
 * that should reach a tablet on a school network.
 *
 * Run once after merging the frontend branch, before `npm run images:manifest`:
 *   npx tsx scripts/importFrontendArtwork.ts
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "frontend", "src", "assets");
const AAC_OUT = path.join(ROOT, "public", "default-images");
const BRAND_OUT = path.join(ROOT, "public", "brand");

/** Source PNG (relative to frontend/src/assets) -> published WebP basename. */
const AAC: Record<string, string> = {
  "AAC_BOARD_DEFAULT/I.png": "i",
  "AAC_BOARD_DEFAULT/Want.png": "want",
  "AAC_BOARD_DEFAULT/Need.png": "need",
  "AAC_BOARD_DEFAULT/Like.png": "like",
  "AAC_BOARD_DEFAULT/Dislike.png": "dont-like",
  // Yes, the folder name is misspelled on the frontend branch.
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/yes.png": "yes",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/no.png": "no",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/more.png": "more",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/all_Done.png": "all-done",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEAFULT_ROW2/again.png": "again",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/eat.png": "eat",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/drink.png": "drink",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/bathroom.png": "bathroom",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/hurt.png": "hurt",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/help.png": "help",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW3/break.png": "break",
  // The `_big` variants are the ones the frontend actually rendered.
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/happy_big.png": "happy",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/sad_big.png": "sad",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/angry_big.png": "angry",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/Tired_big.png": "tired",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/go.png": "go",
  "AAC_BOARD_DEFAULT/AAC_BOARD_DEFAULT_ROW4/stop.png": "stop",
};

/**
 * Decorative brand art. The real SVGs (2-4 KB) are copied as-is and beat their
 * PNG twins. `Kids.svg` is not really vector — it is a 1.2 MB raster in SVG
 * clothing and the largest thing on the login screen — so it gets rasterized.
 */
const BRAND: Record<string, string> = {
  "figma/Kids.svg": "kids.webp",
  "figma/evergreen.svg": "evergreen.svg",
  "figma/polypodium.svg": "polypodium.svg",
  "figma/split-leaf.svg": "split-leaf.svg",
  "figma/Musacae.png": "musacae.webp",
  "figma/Clusiacae (2).png": "clusiacae.webp",
};

/** AAC tiles never render larger than ~120px tall; 512 is generous for 2x. */
const MAX_EDGE = 512;

async function main(): Promise<void> {
  if (!existsSync(SRC)) {
    throw new Error(
      `frontend/src/assets not found. Run this from the integration worktree before removing frontend/.`,
    );
  }
  await mkdir(AAC_OUT, { recursive: true });
  await mkdir(BRAND_OUT, { recursive: true });

  let before = 0;
  let after = 0;
  const seen = new Map<string, string>();

  for (const [relative, basename] of Object.entries(AAC)) {
    const from = path.join(SRC, relative);
    if (!existsSync(from)) throw new Error(`missing source artwork: ${relative}`);
    const input = await readFile(from);
    before += input.byteLength;

    // Flag byte-identical duplicates rather than silently shipping both.
    const digest = createHash("sha256").update(input).digest("hex");
    const duplicate = seen.get(digest);
    if (duplicate) console.warn(`  ! ${basename} is identical to ${duplicate}`);
    seen.set(digest, basename);

    const output = await sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toBuffer();
    after += output.byteLength;
    await writeFile(path.join(AAC_OUT, `${basename}.webp`), output);
    console.log(
      `  ${basename}.webp  ${kb(input.byteLength)} -> ${kb(output.byteLength)}`,
    );
  }

  for (const [relative, name] of Object.entries(BRAND)) {
    const from = path.join(SRC, relative);
    if (!existsSync(from)) throw new Error(`missing brand asset: ${relative}`);
    if (name.endsWith(".svg")) {
      await copyFile(from, path.join(BRAND_OUT, name));
      console.log(`  brand/${name}  (copied)`);
      continue;
    }
    const input = await readFile(from);
    const isHero = name === "kids.webp";
    const output = await sharp(input, { density: 144 })
      .rotate()
      .resize({
        width: isHero ? 900 : 640,
        height: isHero ? 900 : 640,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: isHero ? 82 : 80, effort: 6 })
      .toBuffer();
    await writeFile(path.join(BRAND_OUT, name), output);
    console.log(`  brand/${name}  ${kb(input.byteLength)} -> ${kb(output.byteLength)}`);
  }

  console.log(
    `\n${Object.keys(AAC).length} AAC tiles: ${kb(before)} -> ${kb(after)} ` +
      `(${Math.round((1 - after / before) * 100)}% smaller)`,
  );
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
