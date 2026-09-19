// Server-only module: requires the Supabase service-role key for writes.
import "../serverEnv.js";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ImageCandidate, SharedAssetCache, AssetRecord, VisualAssetRequest } from "./types.js";

type SupabaseAssetCacheOptions = {
  client?: SupabaseClient;
  supabaseUrl?: string;
  serviceRoleKey?: string;
  bucketName?: string;
  signedUrlTtlSeconds?: number;
};

type AssetRow = {
  cache_key: string;
  vocabulary_id: string;
  source: "web" | "generated" | "local" | "placeholder";
  object_path: string;
  source_url: string | null;
  attribution: string | null;
  prompt_version: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number;
  sha256: string;
  expires_at: string | null;
};

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function toBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function hashData(data: Uint8Array): string {
  return createHash("sha256").update(toBuffer(data)).digest("hex");
}

function toAssetRecord(row: AssetRow, signedUrl: string, source: AssetRecord["source"]): AssetRecord {
  return {
    cacheKey: row.cache_key,
    vocabularyId: row.vocabulary_id,
    source,
    assetUrl: signedUrl,
    objectPath: row.object_path,
    sourceUrl: row.source_url ?? undefined,
    attribution: row.attribution ?? undefined,
    promptVersion: row.prompt_version,
    mimeType: row.mime_type,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    byteSize: row.byte_size,
    sha256: row.sha256,
    expiresAt: row.expires_at ?? undefined
  };
}

export function createSupabaseAssetCache(options: SupabaseAssetCacheOptions = {}): SharedAssetCache {
  const supabaseUrl = options.supabaseUrl ?? process.env.SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = options.bucketName ?? process.env.SUPABASE_ASSET_BUCKET ?? "bridgeboard-ai-assets";
  const signedUrlTtlSeconds = options.signedUrlTtlSeconds ?? Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? 3600);

  if (!options.client && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the shared asset cache.");
  }

  const client =
    options.client ??
    createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

  return {
    async get(cacheKey) {
      const { data, error } = await client
        .from("ai_asset_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .eq("status", "ready")
        .maybeSingle<AssetRow>();

      if (error) {
        throw error;
      }
      if (!data) {
        return null;
      }

      const { data: signed, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(data.object_path, signedUrlTtlSeconds);
      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Supabase did not return a signed asset URL.");
      }

      await client
        .from("ai_asset_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", cacheKey);

      return toAssetRecord(data, signed.signedUrl, "supabase");
    },

    async put(record) {
      // The shared cache is authoritative; put is intentionally a no-op for records
      // that already exist and is useful for the common AssetCache interface.
      await client
        .from("ai_asset_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", record.cacheKey);
    },

    async saveCandidate(request, candidate) {
      const sha256 = hashData(candidate.data);
      const objectPath = `aac/${request.vocabularyId}/${sha256}.${extensionForMimeType(candidate.mimeType)}`;
      const { error: uploadError } = await client.storage.from(bucketName).upload(objectPath, toBuffer(candidate.data), {
        contentType: candidate.mimeType,
        cacheControl: "31536000",
        upsert: true
      });

      if (uploadError) {
        throw uploadError;
      }

      const row = {
        cache_key: request.cacheKey,
        vocabulary_id: request.vocabularyId,
        source: candidate.source,
        object_path: objectPath,
        source_url: candidate.sourceUrl ?? null,
        attribution: candidate.attribution ?? null,
        prompt_version: request.styleVersion,
        mime_type: candidate.mimeType,
        width: null,
        height: null,
        byte_size: candidate.data.byteLength,
        sha256,
        status: "ready",
        last_used_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from("ai_asset_cache")
        .upsert(row, { onConflict: "cache_key" })
        .select("*")
        .single<AssetRow>();
      if (error || !data) {
        throw error ?? new Error("Supabase did not return the cached asset row.");
      }

      const { data: signed, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(objectPath, signedUrlTtlSeconds);
      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Supabase did not return a signed asset URL.");
      }

      return toAssetRecord(data, signed.signedUrl, candidate.source);
    }
  };
}

export async function ensureSupabaseAssetBucket(
  client: SupabaseClient,
  bucketName = process.env.SUPABASE_ASSET_BUCKET ?? "bridgeboard-ai-assets"
): Promise<void> {
  const { error } = await client.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: Number(process.env.AI_ASSET_MAX_BYTES ?? 5 * 1024 * 1024),
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"]
  });

  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}
