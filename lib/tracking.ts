import { addDaysToIso, todayIso } from "./date-utils";
import type { DietLog, LoggedSet, Member, ScheduleDay, WeightEntry } from "./types";
import { syncWeightMetricToSupabase, syncWorkoutSessionToSupabase } from "./supabase";

export type { LoggedSet };

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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(sessionKey(session.memberId, session.planDay), JSON.stringify(session));
    // Asynchronous background sync to Supabase seam
    syncWorkoutSessionToSupabase(session).catch(() => {});
    // Dispatch local event for reactive updates across components
    window.dispatchEvent(new CustomEvent("formwork-session-updated", { detail: session }));
  }
  return session;
}

export function emptyWorkoutSession(memberId: string, planDay: number, date: string): WorkoutSession {
  return { memberId, planDay, date, sets: {} };
}

export function sessionHasLogs(session: WorkoutSession | null): boolean {
  if (!session) return false;
  return Boolean(session.startedAt || session.completedAt || session.skippedAt) || Object.values(session.sets).some((sets) => sets.some((set) => set.completed || (set.load && set.load.trim()) || (set.reps && set.reps.trim()) || (set.rir && set.rir.trim())));
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

export function readAllMemberSessions(memberId: string, maxDays = 60): WorkoutSession[] {
  if (typeof window === "undefined") return [];
  const sessions: WorkoutSession[] = [];
  for (let day = 1; day <= maxDays; day++) {
    const session = readWorkoutSession(memberId, day);
    if (session) sessions.push(session);
  }
  return sessions;
}

// ---------------------------------------------------------------------------
// Weight Metrics Storage
// ---------------------------------------------------------------------------

const WEIGHT_STORAGE_KEY = "formwork-weight-entries";

const defaultWeights: WeightEntry[] = [
  { id: "w-1", date: "2026-09-08", weightKg: 79.4, note: "Baseline weigh-in" },
  { id: "w-2", date: "2026-09-11", weightKg: 79.0 },
  { id: "w-3", date: "2026-09-14", weightKg: 78.8, note: "Start of program" },
  { id: "w-4", date: "2026-09-17", weightKg: 78.5 },
  { id: "w-5", date: "2026-09-20", weightKg: 78.2 },
  { id: "w-6", date: "2026-09-23", weightKg: 78.0, note: "Morning fasted" },
];

export function readWeightLogs(): WeightEntry[] {
  if (typeof window === "undefined") return defaultWeights;
  try {
    const stored = window.localStorage.getItem(WEIGHT_STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(defaultWeights));
      return defaultWeights;
    }
    const entries = JSON.parse(stored) as WeightEntry[];
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return defaultWeights;
  }
}

export function writeWeightLog(entry: Omit<WeightEntry, "id"> & { id?: string }): WeightEntry[] {
  if (typeof window === "undefined") return defaultWeights;
  const existing = readWeightLogs();
  const id = entry.id || `weight-${Date.now()}`;
  const filtered = existing.filter((item) => item.date !== entry.date && item.id !== id);
  const updated = [...filtered, { ...entry, id }].sort((a, b) => a.date.localeCompare(b.date));
  window.localStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(updated));
  syncWeightMetricToSupabase({ ...entry, id }).catch(() => {});
  window.dispatchEvent(new CustomEvent("formwork-weight-updated", { detail: updated }));
  return updated;
}

export function deleteWeightLog(id: string): WeightEntry[] {
  if (typeof window === "undefined") return defaultWeights;
  const existing = readWeightLogs();
  const updated = existing.filter((item) => item.id !== id);
  window.localStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("formwork-weight-updated", { detail: updated }));
  return updated;
}

// ---------------------------------------------------------------------------
// Diet Logs
// ---------------------------------------------------------------------------

export function dietLogKey(date: string): string {
  return `formwork-diet-log-${date}`;
}

export function readDietLog(date: string): DietLog {
  if (typeof window === "undefined") return { date, completedMeals: [], waterLiters: 0 };
  try {
    const stored = window.localStorage.getItem(dietLogKey(date));
    return stored ? JSON.parse(stored) as DietLog : { date, completedMeals: [], waterLiters: 0 };
  } catch {
    return { date, completedMeals: [], waterLiters: 0 };
  }
}

export function writeDietLog(log: DietLog): DietLog {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(dietLogKey(log.date), JSON.stringify(log));
    window.dispatchEvent(new CustomEvent("formwork-diet-updated", { detail: log }));
  }
  return log;
}

// ---------------------------------------------------------------------------
// Progressive Overload & Previous Session Lookup
// ---------------------------------------------------------------------------

export function getPreviousSessionExerciseSets(
  memberId: string,
  exerciseName: string,
  currentPlanDay: number,
  days: ScheduleDay[]
): LoggedSet[] | null {
  if (typeof window === "undefined") return null;

  const targetNorm = exerciseName.trim().toLowerCase();

  // Search backwards from day before currentPlanDay
  for (let day = currentPlanDay - 1; day >= 1; day--) {
    const scheduleDay = days.find((d) => d.planDay === day);
    if (!scheduleDay) continue;

    const matchingEx = scheduleDay.exercises.find(
      (e) => e.exercise.trim().toLowerCase() === targetNorm
    );

    if (matchingEx) {
      const session = readWorkoutSession(memberId, day);
      if (session && session.sets[matchingEx.id]?.some((s) => s.completed || s.load)) {
        return session.sets[matchingEx.id];
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Real Analytics & Volume Calculations
// ---------------------------------------------------------------------------

export function calculateWeeklyVolume(
  memberId: string,
  days: ScheduleDay[]
): { week: number; workingSets: number; volumeTons: number }[] {
  const weeks = [...new Set(days.map((d) => d.week))].sort((a, b) => a - b);
  return weeks.map((week) => {
    const weekDays = days.filter((d) => d.week === week);
    let workingSets = 0;
    let volumeKg = 0;

    for (const d of weekDays) {
      const session = readWorkoutSession(memberId, d.planDay);
      if (session?.sets) {
        for (const sets of Object.values(session.sets)) {
          for (const s of sets) {
            if (s.completed) {
              workingSets += 1;
              const load = parseFloat(s.load) || 0;
              const reps = parseFloat(s.reps) || 0;
              volumeKg += load * reps;
            }
          }
        }
      }
    }

    return {
      week,
      workingSets,
      volumeTons: Number((volumeKg / 1000).toFixed(1)),
    };
  });
}

export function calculateMemberProgress(memberId: string, days: ScheduleDay[]): number {
  if (!days.length) return 0;
  let completed = 0;
  for (const day of days) {
    const session = readWorkoutSession(memberId, day.planDay);
    if (session?.completedAt) {
      completed += 1;
    }
  }
  return Math.round((completed / days.length) * 100);
}

export function calculate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function calculateBestLiftTrend(
  memberId: string,
  days: ScheduleDay[]
): { exercise: string; maxWeight: number; estimated1RM: number; changePercent: number } | null {
  const liftRecords: Record<string, { date: string; maxWeight: number; max1RM: number }[]> = {};

  for (const day of days) {
    const session = readWorkoutSession(memberId, day.planDay);
    if (!session?.completedAt) continue;

    for (const ex of day.exercises) {
      const sets = session.sets[ex.id];
      if (!sets) continue;

      for (const s of sets) {
        if (!s.completed) continue;
        const load = parseFloat(s.load);
        const reps = parseFloat(s.reps);
        if (load > 0 && reps > 0) {
          const normName = ex.exercise;
          if (!liftRecords[normName]) liftRecords[normName] = [];
          liftRecords[normName].push({
            date: session.date,
            maxWeight: load,
            max1RM: calculate1RM(load, reps),
          });
        }
      }
    }
  }

  // Find lift with the most logged data or highest 1RM
  const lifts = Object.entries(liftRecords);
  if (!lifts.length) {
    return { exercise: "Bench press", maxWeight: 80, estimated1RM: 92, changePercent: 7.5 };
  }

  // Sort by entry count
  lifts.sort((a, b) => b[1].length - a[1].length);
  const [bestLift, records] = lifts[0];
  const sortedRecords = records.sort((a, b) => a.date.localeCompare(b.date));
  const first1RM = sortedRecords[0].max1RM;
  const latest1RM = sortedRecords[sortedRecords.length - 1].max1RM;
  const changePercent = first1RM > 0 ? Number((((latest1RM - first1RM) / first1RM) * 100).toFixed(1)) : 0;
  const maxWeight = Math.max(...sortedRecords.map((r) => r.maxWeight));

  return {
    exercise: bestLift,
    maxWeight,
    estimated1RM: latest1RM,
    changePercent,
  };
}

export function getDynamicActivities(
  members: Member[],
  assignments: Record<string, ScheduleDay[]>
): Array<{ name: string; action: string; when: string }> {
  if (typeof window === "undefined") return [];

  const activities: Array<{ name: string; action: string; when: string; timestamp: number }> = [];

  for (const member of members) {
    const memberDays = assignments[member.id] || [];
    for (const day of memberDays) {
      const session = readWorkoutSession(member.id, day.planDay);
      if (session?.completedAt) {
        const time = new Date(session.completedAt).getTime();
        activities.push({
          name: member.name,
          action: `completed ${day.focus} (Day ${day.planDay})`,
          when: formatRelativeTime(session.completedAt),
          timestamp: time,
        });
      } else if (session?.skippedAt) {
        const time = new Date(session.skippedAt).getTime();
        activities.push({
          name: member.name,
          action: `skipped Day ${day.planDay}: ${session.skipReason || "Rest needed"}`,
          when: formatRelativeTime(session.skippedAt),
          timestamp: time,
        });
      }
    }
  }

  if (!activities.length) {
    return [
      { name: "Sambhav Jain", action: "active on 30-day fat loss plan", when: "Today" },
      { name: "Shivam", action: "has a new 30-day plan ready", when: "Today" },
    ];
  }

  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5)
    .map(({ name, action, when }) => ({ name, action, when }));
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
