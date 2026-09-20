import type { AssetCache, AssetRecord } from "./types";

export class MemoryAssetCache implements AssetCache {
  private readonly records = new Map<string, AssetRecord>();

  async get(assetKey: string): Promise<AssetRecord | null> {
    const record = this.records.get(assetKey);
    if (!record) return null;

    // Supabase Storage URLs are signed and must never be reused after their
    // expiry. Older records (created before expiresAt was tracked) are also
    // evicted when they are remote URLs, so a dev server hot reload cannot
    // keep serving a stale signed URL forever.
    if (
      (record.expiresAt !== undefined && record.expiresAt <= Date.now()) ||
      (record.url.startsWith("https://") && record.expiresAt === undefined)
    ) {
      this.records.delete(assetKey);
      return null;
    }

    return record;
  }

  async put(record: AssetRecord): Promise<void> {
    this.records.set(record.assetKey, record);
  }

  clear(): void {
    this.records.clear();
  }
}

export const processAssetCache = new MemoryAssetCache();
