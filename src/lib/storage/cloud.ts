"use client";

import type { User } from "@supabase/supabase-js";
import type { CommunicationHistoryEntry } from "./history";
import type { ChildProfile } from "@/types/profile";
import { ChildProfileSchema } from "@/lib/validation/profileSchema";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { user: null, error: new Error("Supabase is not configured."), needsEmailConfirmation: false };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data.user, error, needsEmailConfirmation: false };
}

export async function signUpWithPassword(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { user: null, error: new Error("Supabase is not configured.") };
  const { data, error } = await client.auth.signUp({ email, password });
  return { user: data.user, error, needsEmailConfirmation: !data.session };
}

export async function signOutCloud(): Promise<void> {
  await getSupabaseBrowserClient()?.auth.signOut();
}

export async function clearCloudHistory(userId: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.from("communication_history").delete().eq("user_id", userId);
  if (error) throw error;
}

type ProfileRow = { id: string; user_id: string; settings: unknown };

export async function loadCloudProfile(userId: string): Promise<ChildProfile | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,user_id,settings")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  if (!data) return null;
  const parsed = ChildProfileSchema.safeParse({ ...(data.settings as object), id: data.id });
  return parsed.success ? parsed.data : null;
}

export async function saveCloudProfile(userId: string, profile: ChildProfile): Promise<ChildProfile> {
  const client = getSupabaseBrowserClient();
  if (!client) return profile;
  const { data, error } = await client
    .from("profiles")
    .upsert({ user_id: userId, settings: profile }, { onConflict: "user_id" })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return { ...profile, id: data.id };
}

export async function saveCloudHistory(userId: string, profileId: string | undefined, entry: CommunicationHistoryEntry): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.from("communication_history").insert({
    user_id: userId,
    profile_id: profileId ?? null,
    entry_id: entry.id,
    board_type: entry.boardType,
    question_text: entry.questionText ?? null,
    selected_vocabulary_id: entry.selectedVocabularyId ?? null,
    selected_label: entry.selectedLabel ?? null,
    created_at: entry.timestamp,
  });
  if (error) throw error;
}

export async function loadCloudHistory(userId: string): Promise<CommunicationHistoryEntry[]> {
  const client = getSupabaseBrowserClient();
  if (!client) return [];
  const { data, error } = await client
    .from("communication_history")
    .select("entry_id,created_at,question_text,board_type,selected_vocabulary_id,selected_label")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.entry_id,
    timestamp: row.created_at,
    questionText: row.question_text ?? undefined,
    boardType: row.board_type,
    selectedVocabularyId: row.selected_vocabulary_id ?? undefined,
    selectedLabel: row.selected_label ?? undefined,
  })) as CommunicationHistoryEntry[];
}
