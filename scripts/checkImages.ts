/*
 * Reports which artwork the catalog expects and which files are still missing.
 *
 * Run: npm run images:check
 *
 * Missing assets are not an error — the board falls back to label + icon. This
 * exists so nobody has to read the catalog to find out what to draw.
 */
import { approvedVocabulary } from "@/lib/vocabulary/approvedVocabulary";
import { imageExists, listAvailableImages } from "@/lib/images/imageManifest";

const expected = approvedVocabulary
  .filter((item) => item.imageUrl)
  .map((item) => ({ id: item.id, label: item.label, url: item.imageUrl as string }));

const missing = expected.filter((e) => !imageExists(e.url));
const present = expected.filter((e) => imageExists(e.url));

console.log(`\nexpected artwork : ${expected.length}`);
console.log(`present          : ${present.length}`);
console.log(`missing          : ${missing.length}`);

if (present.length > 0) {
  console.log("\nPRESENT");
  for (const e of present) console.log(`  ${e.url.padEnd(38)} ${e.label}`);
}

if (missing.length > 0) {
  console.log("\nMISSING — drop these files in and rebuild; they are picked up automatically");
  for (const e of missing) console.log(`  ${e.url.padEnd(38)} ${e.label}`);
  console.log("\nThese tiles currently render as label + icon, which is the intended");
  console.log("fallback. Nothing is broken; the boards are simply less visual.");
}

const orphans = listAvailableImages().filter(
  (url) => !expected.some((e) => e.url === url),
);
if (orphans.length > 0) {
  console.log("\nIN public/ BUT NOT REFERENCED BY THE CATALOG");
  for (const url of orphans) console.log(`  ${url}`);
  console.log("Add an imageUrl to the matching vocabulary entry, or the file is unused.");
}

console.log("");
