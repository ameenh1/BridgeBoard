import type { AssetCache, AssetRecord } from "./types.js";

export class MemoryAssetCache implements AssetCache {
  private readonly records = new Map<string, AssetRecord>();

  async get(cacheKey: string): Promise<AssetRecord | null> {
    return this.records.get(cacheKey) ?? null;
  }

  async put(record: AssetRecord): Promise<void> {
    this.records.set(record.cacheKey, record);
  }
}

export function createNoopAssetCache(): AssetCache {
  return {
    async get() {
      return null;
    },
    async put() {
      return undefined;
    }
  };
}
