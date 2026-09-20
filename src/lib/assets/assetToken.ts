import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AssetStreamDescriptor } from "@/types/board";
import type { AssetStreamGrant, VisualAssetRequest } from "./types";
import { MAX_AI_VISUAL_ASSETS } from "./visualRequests";

const RequestSchema = z.object({
  boardId: z.string().uuid(),
  choiceId: z.string().min(1).max(100),
  assetKey: z.string().regex(/^[a-f0-9]{64}$/),
  label: z.string().min(1).max(80),
  normalizedConcept: z.string().min(1).max(80),
  locale: z.string().min(1).max(20),
  styleVersion: z.string().min(1).max(40),
  webSearchQuery: z.string().min(1).max(200),
  generationPrompt: z.string().min(1).max(1_000),
});

const GrantSchema = z.object({
  version: z.literal(1),
  boardId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  requests: z.array(RequestSchema).max(MAX_AI_VISUAL_ASSETS),
});

let developmentSecret: string | undefined;

function signingSecret(): string | null {
  if (process.env.ASSET_STREAM_SECRET) return process.env.ASSET_STREAM_SECRET;
  if (process.env.NODE_ENV === "production") return null;
  developmentSecret ??= randomBytes(32).toString("hex");
  return developmentSecret;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createAssetStreamDescriptor(
  boardId: string,
  requests: VisualAssetRequest[],
  now = Date.now(),
): AssetStreamDescriptor | undefined {
  const secret = signingSecret();
  if (!secret || requests.length === 0) return undefined;

  const grant: AssetStreamGrant = {
    version: 1,
    boardId,
    expiresAt: now + 120_000,
    requests,
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const token = `${payload}.${signature(payload, secret).toString("base64url")}`;
  return {
    endpoint: "/api/resolve-assets",
    token,
    expiresAt: new Date(grant.expiresAt).toISOString(),
  };
}

export function verifyAssetStreamToken(token: string, now = Date.now()): AssetStreamGrant {
  const secret = signingSecret();
  if (!secret) throw new Error("asset_stream_unconfigured");
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) throw new Error("asset_stream_invalid");

  const received = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("asset_stream_invalid");
  }

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("asset_stream_invalid");
  }
  const parsed = GrantSchema.safeParse(json);
  if (!parsed.success) throw new Error("asset_stream_invalid");
  if (parsed.data.expiresAt <= now) throw new Error("asset_stream_expired");
  return parsed.data;
}

export function isAssetStreamConfigured(): boolean {
  return Boolean(signingSecret());
}
