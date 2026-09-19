"use client";

import type { AuthResult } from "@/types/auth";

/**
 * Browser-side calls into the auth routes.
 *
 * There is no Supabase client here and there should never be one: the whole
 * exchange is email and password out, an httpOnly cookie back. Nothing in the
 * bundle can read the session token.
 *
 * None of these reject. Every transport failure becomes `unavailable`, which
 * the login screen renders as "accounts aren't reachable — continue locally".
 * A caregiver standing in front of a non-verbal child should never be left
 * looking at a spinner because an auth server is down.
 */

const UNAVAILABLE: AuthResult = { status: "unavailable" };

async function post(path: string, body?: unknown): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // Never let a cached response stand in for a real auth answer.
      cache: "no-store",
    });
    return (await response.json()) as AuthResult;
  } catch {
    return UNAVAILABLE;
  }
}

export function signUp(email: string, password: string): Promise<AuthResult> {
  return post("/api/auth/signup", { email, password });
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return post("/api/auth/login", { email, password });
}

export function signOut(): Promise<AuthResult> {
  return post("/api/auth/logout");
}

export async function fetchSession(signal?: AbortSignal): Promise<AuthResult> {
  try {
    const response = await fetch("/api/auth/session", { signal, cache: "no-store" });
    return (await response.json()) as AuthResult;
  } catch {
    return UNAVAILABLE;
  }
}
