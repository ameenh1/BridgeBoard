import type { AssetCache, AssetRecord } from "./types";

export class MemoryAssetCache implements AssetCache {
  private readonly records = new Map<string, AssetRecord>();

  async get(assetKey: string): Promise<AssetRecord | null> {
    return this.records.get(assetKey) ?? null;
  }

  async put(record: AssetRecord): Promise<void> {
    this.records.set(record.assetKey, record);
  }

  clear(): void {
    this.records.clear();
  }
}

export const processAssetCache = new MemoryAssetCache();
