import type { PlanAssignment } from "./types";

export function publishedPlanKey(memberId: string): string {
  return `formwork-published-plan-${memberId}`;
}

export function draftPlanKey(memberId: string): string {
  return `formwork-draft-plan-${memberId}`;
}

export function readPublishedPlan(memberId: string): PlanAssignment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(publishedPlanKey(memberId));
    if (!raw) return null;
    return JSON.parse(raw) as PlanAssignment;
  } catch {
    return null;
  }
}

export function writePublishedPlan(assignment: PlanAssignment): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(publishedPlanKey(assignment.memberId), JSON.stringify(assignment));
  window.dispatchEvent(new CustomEvent("formwork-plan-updated", { detail: assignment }));
}

export function readDraftPlan(memberId: string): PlanAssignment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftPlanKey(memberId));
    if (!raw) return null;
    return JSON.parse(raw) as PlanAssignment;
  } catch {
    return null;
  }
}

export function writeDraftPlan(assignment: PlanAssignment): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftPlanKey(assignment.memberId), JSON.stringify(assignment));
}

/**
 * Returns the client-side published plan if one exists, otherwise falls back
 * to the server-seeded assignment.
 */
export function resolveActiveAssignment(serverAssignment: PlanAssignment): PlanAssignment {
  if (typeof window === "undefined") return serverAssignment;
  const published = readPublishedPlan(serverAssignment.memberId);
  return published || serverAssignment;
}

/**
 * Exports all local data (sessions, weight logs, diet logs, plans) as JSON.
 */
export function exportAllUserData(): string {
  if (typeof window === "undefined") return "{}";
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("formwork-")) {
      try {
        dump[key] = JSON.parse(window.localStorage.getItem(key) || "null");
      } catch {
        dump[key] = window.localStorage.getItem(key);
      }
    }
  }
  return JSON.stringify(dump, null, 2);
}
