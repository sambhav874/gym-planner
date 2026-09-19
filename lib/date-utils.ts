const planDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

export function addDaysToIso(startDate: string, offset: number): string {
  const date = planDate(startDate);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatPlanDate(value: string, includeYear = true): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(planDate(value));
}

export function formatPlanWeekday(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(planDate(value));
}

export function planEndDate(startDate: string, dayCount: number): string {
  return addDaysToIso(startDate, Math.max(dayCount - 1, 0));
}
