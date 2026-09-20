import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AssetRecord, ImageCandidate, SharedAssetCache, VisualAssetRequest } from "./types";

type AssetRow = {
  cache_key: string;
  choice_id: string;
  source: "web" | "generated";
  object_path: string;
  source_url: string | null;
  attribution: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number;
  sha256: string;
};

type Options = {
  client?: SupabaseClient;
  url?: string;
  serviceRoleKey?: string;
  bucket?: string;
  signedUrlTtlSeconds?: number;
};

function toRecord(
  row: AssetRow,
  url: string,
  source: AssetRecord["source"],
  expiresAt: number,
): AssetRecord {
  return {
    assetKey: row.cache_key,
    choiceId: row.choice_id,
    source,
    url,
    expiresAt,
    objectPath: row.object_path,
    sourceUrl: row.source_url ?? undefined,
    attribution: row.attribution ?? undefined,
    mimeType: row.mime_type,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    byteSize: row.byte_size,
    sha256: row.sha256,
  };
}

export function createSupabaseAssetCache(options: Options = {}): SharedAssetCache {
  const url = options.url ?? process.env.SUPABASE_URL;
  const key = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = options.bucket ?? process.env.SUPABASE_ASSET_BUCKET ?? "bridgeboard-ai-assets";
  const ttl = options.signedUrlTtlSeconds ?? Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? 3600);
  if (!options.client && (!url || !key)) throw new Error("supabase_cache_unconfigured");

  const client = options.client ?? createClient(url as string, key as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async get(assetKey) {
      const { data, error } = await client
        .from("ai_asset_cache")
        .select("*")
        .eq("cache_key", assetKey)
        .eq("status", "ready")
        .maybeSingle<AssetRow>();
      if (error) throw error;
      if (!data) return null;

      const { data: signed, error: signedError } = await client.storage
        .from(bucket)
        .createSignedUrl(data.object_path, ttl);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("signed_url_missing");

      const { error: touchError } = await client
        .from("ai_asset_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", assetKey);
      if (touchError) console.warn("[asset-cache] last_used update failed", touchError.message);
      return toRecord(data, signed.signedUrl, "cache", Date.now() + ttl * 1000);
    },

    async put(record) {
      const { error } = await client
        .from("ai_asset_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", record.assetKey);
      if (error) throw error;
    },

    async saveCandidate(request: VisualAssetRequest, candidate: ImageCandidate) {
      const buffer = Buffer.from(candidate.data);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const objectPath = `aac/${request.assetKey}/${sha256}.webp`;
      const { error: uploadError } = await client.storage.from(bucket).upload(objectPath, buffer, {
        contentType: candidate.mimeType,
        cacheControl: "31536000",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const row = {
        cache_key: request.assetKey,
        choice_id: request.choiceId,
        source: candidate.source,
        object_path: objectPath,
        source_url: candidate.sourceUrl ?? null,
        attribution: candidate.attribution ?? null,
        style_version: request.styleVersion,
        mime_type: candidate.mimeType,
        width: candidate.width ?? null,
        height: candidate.height ?? null,
        byte_size: candidate.data.byteLength,
        sha256,
        status: "ready",
        last_used_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from("ai_asset_cache")
        .upsert(row, { onConflict: "cache_key" })
        .select("*")
        .single<AssetRow>();
      if (error || !data) {
        await client.storage.from(bucket).remove([objectPath]).catch(() => undefined);
        throw error ?? new Error("cache_row_missing");
      }

      const { data: signed, error: signedError } = await client.storage
        .from(bucket)
        .createSignedUrl(objectPath, ttl);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("signed_url_missing");
      return toRecord(data, signed.signedUrl, candidate.source, Date.now() + ttl * 1000);
    },
  };
}

export function createOptionalSupabaseAssetCache(): SharedAssetCache | undefined {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  return createSupabaseAssetCache();
}

export async function ensureSupabaseAssetBucket(
  client: SupabaseClient,
  bucket = process.env.SUPABASE_ASSET_BUCKET ?? "bridgeboard-ai-assets",
): Promise<void> {
  const { data, error: getError } = await client.storage.getBucket(bucket);
  if (data) return;
  if (getError && !/not found/i.test(getError.message)) throw getError;

  const { error } = await client.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: Number(process.env.AI_ASSET_MAX_BYTES ?? 5 * 1024 * 1024),
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}
