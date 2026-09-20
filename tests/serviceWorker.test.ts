import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SW = path.join(ROOT, "public", "sw.js");

function serviceWorkerSource(): string {
  if (!existsSync(SW)) {
    execFileSync("npx", ["tsx", "scripts/generateServiceWorker.ts"], {
      cwd: ROOT,
      shell: process.platform === "win32",
    });
  }
  return readFileSync(SW, "utf8");
}

function precacheList(source: string): string[] {
  const match = source.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (!match) throw new Error("no PRECACHE list in sw.js");
  return JSON.parse(match[1]) as string[];
}

describe("offline service worker", () => {
  const source = serviceWorkerSource();
  const precache = precacheList(source);

  it("precaches every bundled AAC tile", () => {
    const onDisk = readdirSync(path.join(ROOT, "public", "default-images"))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => `/default-images/${f}`);

    expect(onDisk.length).toBeGreaterThan(0);
    for (const asset of onDisk) {
      // A tile missing here is a tile that is blank offline.
      expect(precache, `${asset} is not precached`).toContain(asset);
    }
  });

  it("precaches the shell so a reload with no network still reaches a board", () => {
    expect(precache).toContain("/");
  });

  it("never caches the API", () => {
    // A cached classify response is a stale board; a cached auth response is
    // a security bug; a cached signed URL is a guaranteed broken image later.
    expect(source).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    expect(precache.filter((url) => url.startsWith("/api"))).toEqual([]);
  });

  it("only caches same-origin responses", () => {
    expect(source).toMatch(/url\.origin !== self\.location\.origin/);
  });

  it("serves navigations network-first so a deploy is picked up", () => {
    const navBlock = source.slice(source.indexOf('request.mode === "navigate"'));
    // fetch() must come before the caches.match() fallback.
    expect(navBlock.indexOf("await fetch(request)")).toBeLessThan(
      navBlock.indexOf("caches.match"),
    );
  });

  it("tolerates a missing precache entry instead of losing offline support", () => {
    // cache.addAll rejects atomically; one 404 would silently disable the
    // whole worker. Entries are added individually and swallowed.
    expect(source).toMatch(/cache\.add\(/);
    expect(source).not.toMatch(/addAll/);
  });

  it("evicts caches from previous versions on activate", () => {
    expect(source).toMatch(/caches\.delete/);
    expect(source).toMatch(/const VERSION = "[0-9a-f]{12}"/);
  });

  it("is registered only in production", () => {
    const registrar = readFileSync(
      path.join(ROOT, "src", "components", "ServiceWorkerRegistrar.tsx"),
      "utf8",
    );
    expect(registrar).toMatch(/NODE_ENV !== "production"/);
  });
});
