import type { AssetCache, AssetRecord } from "./types.js";

const CACHE_KEY_PREFIX = "https://bridgeboard.local/asset-cache/";

/** Browser hot cache. The frontend may use this without importing server modules. */
export function createBrowserAssetCache(cacheName = "bridgeboard-aac-assets"): AssetCache {
  return {
    async get(cacheKey) {
      if (typeof caches === "undefined") {
        return null;
      }

      const cache = await caches.open(cacheName);
      const response = await cache.match(`${CACHE_KEY_PREFIX}${encodeURIComponent(cacheKey)}`);
      if (!response) {
        return null;
      }

      const serialized = response.headers.get("x-bridgeboard-asset-record");
      if (!serialized) {
        return null;
      }

      const record = JSON.parse(serialized) as AssetRecord;
      // Signed Supabase URLs expire. The browser hot cache must return a local
      // object URL backed by the cached bytes instead of the old signed URL.
      const blob = await response.blob();
      return { ...record, assetUrl: URL.createObjectURL(blob), source: "local" };
    },

    async put(record) {
      if (typeof caches === "undefined") {
        return;
      }

      const response = await fetch(record.assetUrl);
      if (!response.ok) {
        return;
      }

      const headers = new Headers(response.headers);
      headers.set("x-bridgeboard-asset-record", JSON.stringify(record));
      const body = await response.arrayBuffer();
      const cache = await caches.open(cacheName);
      await cache.put(
        `${CACHE_KEY_PREFIX}${encodeURIComponent(record.cacheKey)}`,
        new Response(body, { headers })
      );
    }
  };
}
