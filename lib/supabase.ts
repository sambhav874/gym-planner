import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WeightEntry } from "./types";
import type { WorkoutSession } from "./tracking";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseClient;
  } catch (err) {
    console.warn("Supabase client initialization skipped:", err);
    return null;
  }
}

/**
 * Asynchronously attempts to sync a workout session to Supabase.
 * In local demo mode, this fails silently without disturbing the user.
 */
export async function syncWorkoutSessionToSupabase(session: WorkoutSession): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: user } = await client.auth.getUser();
    if (!user?.user) return false;

    // Check if session exists or upsert
    const { error } = await client.from("workout_sessions").upsert({
      member_id: user.user.id,
      session_date: session.date,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      skipped_at: session.skippedAt,
      skip_reason: session.skipReason,
    }, { onConflict: "assignment_id,session_date" });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Asynchronously attempts to sync a bodyweight metric to Supabase.
 */
export async function syncWeightMetricToSupabase(entry: WeightEntry): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: user } = await client.auth.getUser();
    if (!user?.user) return false;

    const { error } = await client.from("body_metrics").upsert({
      member_id: user.user.id,
      measured_on: entry.date,
      weight_kg: entry.weightKg,
      notes: entry.note,
    }, { onConflict: "member_id,measured_on" });

    return !error;
  } catch {
    return false;
  }
}
