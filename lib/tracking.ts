import { addDaysToIso } from "./date-utils";

export interface LoggedSet {
  load: string;
  reps: string;
  rir: string;
  completed: boolean;
}

export interface WorkoutSession {
  memberId: string;
  planDay: number;
  date: string;
  sets: Record<string, LoggedSet[]>;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  skipReason?: string;
}

export type DayStatus = "done" | "in-progress" | "not-done" | "today" | "planned" | "skipped";

export function sessionKey(memberId: string, planDay: number): string {
  return `formwork-session-${memberId}-${planDay}`;
}

export function readWorkoutSession(memberId: string, planDay: number): WorkoutSession | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(sessionKey(memberId, planDay));
    return stored ? JSON.parse(stored) as WorkoutSession : null;
  } catch {
    return null;
  }
}

export function writeWorkoutSession(session: WorkoutSession): WorkoutSession {
  if (typeof window !== "undefined") window.localStorage.setItem(sessionKey(session.memberId, session.planDay), JSON.stringify(session));
  return session;
}

export function emptyWorkoutSession(memberId: string, planDay: number, date: string): WorkoutSession {
  return { memberId, planDay, date, sets: {} };
}

export function sessionHasLogs(session: WorkoutSession | null): boolean {
  if (!session) return false;
  return Boolean(session.startedAt || session.completedAt || session.skippedAt) || Object.values(session.sets).some((sets) => sets.some((set) => set.completed || set.load.trim() || set.reps.trim() || set.rir.trim()));
}

export function markWorkoutComplete(memberId: string, planDay: number, startDate: string): WorkoutSession {
  const existing = readWorkoutSession(memberId, planDay) || emptyWorkoutSession(memberId, planDay, addDaysToIso(startDate, planDay - 1));
  return writeWorkoutSession({ ...existing, startedAt: existing.startedAt || new Date().toISOString(), skippedAt: undefined, skipReason: undefined, completedAt: new Date().toISOString() });
}

export function startWorkout(memberId: string, planDay: number, startDate: string): WorkoutSession {
  const existing = readWorkoutSession(memberId, planDay) || emptyWorkoutSession(memberId, planDay, addDaysToIso(startDate, planDay - 1));
  return writeWorkoutSession({ ...existing, startedAt: existing.startedAt || new Date().toISOString(), skippedAt: undefined, skipReason: undefined });
}

export function markWorkoutSkipped(memberId: string, planDay: number, startDate: string, reason: string): WorkoutSession {
  const existing = readWorkoutSession(memberId, planDay) || emptyWorkoutSession(memberId, planDay, addDaysToIso(startDate, planDay - 1));
  return writeWorkoutSession({ ...existing, skippedAt: new Date().toISOString(), skipReason: reason.trim() || "Unable to train", completedAt: undefined });
}

export function dayStatus(startDate: string, planDay: number, today: string, session: WorkoutSession | null): DayStatus {
  const date = addDaysToIso(startDate, planDay - 1);
  if (session?.skippedAt) return "skipped";
  if (session?.completedAt) return "done";
  if (date < today) return sessionHasLogs(session) ? "in-progress" : "not-done";
  if (date === today) return sessionHasLogs(session) ? "in-progress" : "today";
  return "planned";
}
