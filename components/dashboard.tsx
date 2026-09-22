"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, todayIso } from "@/lib/date-utils";
import type { Member, PlanAssignment, WeightEntry } from "@/lib/types";
import {
  calculateMemberProgress,
  dayStatus,
  getDynamicActivities,
  readWorkoutSession,
  readWeightLogs,
  writeWeightLog,
  type DayStatus,
  type WorkoutSession,
} from "@/lib/tracking";
import { resolveActiveAssignment } from "@/lib/client-plan";
import { OnboardingCard } from "./onboarding";

const statusLabels: Record<DayStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  "not-done": "Not done",
  today: "Today",
  planned: "Planned",
  skipped: "Skipped",
};

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0] || name;
  if (hour < 12) return `Good morning, ${firstName}.`;
  if (hour < 17) return `Good afternoon, ${firstName}.`;
  return `Good evening, ${firstName}.`;
}

export function Dashboard({
  members: initialMembers,
  assignment: serverAssignment,
}: {
  members: Member[];
  assignment: PlanAssignment;
}) {
  const today = todayIso();
  const [assignment, setAssignment] = useState<PlanAssignment>(() =>
    resolveActiveAssignment(serverAssignment)
  );
  const [sessions, setSessions] = useState<Record<number, WorkoutSession | null>>({});
  const [weightLogs, setWeightLogs] = useState<WeightEntry[]>(() => readWeightLogs());
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  // Sync client-side published plan
  useEffect(() => {
    setAssignment(resolveActiveAssignment(serverAssignment));

    const onPlanUpdate = () => {
      setAssignment(resolveActiveAssignment(serverAssignment));
    };

    const onWeightUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<WeightEntry[]>;
      if (customEvent.detail) setWeightLogs(customEvent.detail);
    };

    window.addEventListener("formwork-plan-updated", onPlanUpdate);
    window.addEventListener("formwork-weight-updated", onWeightUpdate);

    return () => {
      window.removeEventListener("formwork-plan-updated", onPlanUpdate);
      window.removeEventListener("formwork-weight-updated", onWeightUpdate);
    };
  }, [serverAssignment]);

  // Load member sessions
  const refreshSessions = () => {
    setSessions(
      Object.fromEntries(
        assignment.days.map((day) => [day.planDay, readWorkoutSession(assignment.memberId, day.planDay)])
      )
    );
  };

  useEffect(() => {
    refreshSessions();
    const handleSessionUpdate = () => refreshSessions();
    window.addEventListener("formwork-session-updated", handleSessionUpdate);
    return () => window.removeEventListener("formwork-session-updated", handleSessionUpdate);
  }, [assignment.days, assignment.memberId]);

  const currentPlanDay = useMemo(() => {
    const planDay = planDayForDate(assignment.startDate, today);
    if (planDay && assignment.days.some((day) => day.planDay === planDay)) return planDay;
    return today < assignment.startDate ? assignment.days[0]?.planDay : assignment.days.at(-1)?.planDay;
  }, [assignment.days, assignment.startDate, today]);

  const currentDay = assignment.days.find((day) => day.planDay === currentPlanDay) || assignment.days[0];
  const currentStatus = currentDay
    ? dayStatus(assignment.startDate, currentDay.planDay, today, sessions[currentDay.planDay] || null)
    : "planned";

  const weekDays = assignment.days.filter((day) => day.week === currentDay?.week).slice(0, 7);
  const loggedThisWeek = weekDays.filter((day) =>
    ["done", "in-progress"].includes(
      dayStatus(assignment.startDate, day.planDay, today, sessions[day.planDay] || null)
    )
  ).length;

  // Real member progress calculations
  const dynamicMembers = useMemo(() => {
    return initialMembers.map((m) => {
      const memberDays = m.id === assignment.memberId ? assignment.days : assignment.days;
      const progress = calculateMemberProgress(m.id, memberDays);
      return {
        ...m,
        progress,
      };
    });
  }, [initialMembers, assignment.memberId, assignment.days, sessions]);

  // Dynamic activities
  const recentActivities = useMemo(() => {
    const assignmentsMap: Record<string, typeof assignment.days> = {
      [assignment.memberId]: assignment.days,
    };
    return getDynamicActivities(dynamicMembers, assignmentsMap);
  }, [dynamicMembers, assignment]);

  // Latest weight metrics
  const latestWeightEntry = weightLogs[weightLogs.length - 1];
  const latestWeight = latestWeightEntry?.weightKg ? `${latestWeightEntry.weightKg.toFixed(1)} kg` : "78.0 kg";
  const twoWeekAvg = useMemo(() => {
    if (!weightLogs.length) return "78.2 kg";
    const recent = weightLogs.slice(-5);
    const avg = recent.reduce((sum, item) => sum + item.weightKg, 0) / recent.length;
    return `${avg.toFixed(1)} kg`;
  }, [weightLogs]);

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeight);
    if (val > 30 && val < 300) {
      writeWeightLog({
        date: today,
        weightKg: Math.round(val * 10) / 10,
        note: "Daily check-in",
      });
      setShowWeightInput(false);
      setNewWeight("");
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            {formatPlanWeekday(today)}, {formatPlanDate(today)}
          </div>
          <h1>{getGreeting(assignment.memberName)}</h1>
          <p>Start with today’s plan. Everything else can wait.</p>
        </div>
        <div className="top-actions">
          <Link className="button ghost" href="/import">
            Trainer tools
          </Link>
          <span className="avatar large">
            {assignment.memberName
              .split(" ")
              .map((word) => word[0])
              .join("")}
          </span>
        </div>
      </div>

      <OnboardingCard />

      <div className="today-card card">
        <div>
          <div className="eyebrow">Today · Day {currentDay?.planDay} of {assignment.days.length}</div>
          <h2>{currentDay?.focus || "Your plan"}</h2>
          <p>
            {currentDay?.isRecovery
              ? "A lighter recovery day still counts."
              : `${currentDay?.exercises.length || 0} movements to complete`} ·{" "}
            <strong>{statusLabels[currentStatus]}</strong>
          </p>
        </div>
        <Link className="button primary" href={`/plan/${assignment.memberId}?day=${currentDay?.planDay || 1}`}>
          {currentStatus === "done" ? "View today’s log" : currentStatus === "today" ? "Start today" : "Review today"}
        </Link>
      </div>

      <div className="quick-stats">
        <div className="quick-stat">
          <span>This week</span>
          <strong>
            {loggedThisWeek} / {weekDays.length}
          </strong>
          <small>days with activity</small>
        </div>
        <div className="quick-stat">
          <span>Plan length</span>
          <strong>{assignment.days.length} days</strong>
          <small>started {formatPlanDate(assignment.startDate, false)}</small>
        </div>
        <div className="quick-stat">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Current weight</span>
            <button
              type="button"
              className="link-btn-subtle"
              onClick={() => setShowWeightInput(!showWeightInput)}
            >
              {showWeightInput ? "Cancel" : "+ Log"}
            </button>
          </div>
          <strong>{latestWeight}</strong>
          <small>recent average · {twoWeekAvg}</small>
        </div>
      </div>

      {showWeightInput && (
        <form onSubmit={handleSaveWeight} className="quick-weight-form card">
          <div className="card-title-row">
            <div>
              <h3>Log Today&apos;s Bodyweight</h3>
              <p className="card-subtitle">Keep your weigh-in consistent (e.g. morning fasted).</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              className="set-input"
              style={{ maxWidth: 160 }}
              placeholder="e.g. 78.2"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              autoFocus
            />
            <button type="submit" className="button primary small">
              Save weight
            </button>
            <button type="button" className="button ghost small" onClick={() => setShowWeightInput(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="notice" style={{ marginTop: 20 }}>
        <span className="notice-icon">i</span>
        <span>
          <strong>Simple rule:</strong> log the day when you finish it. Past days without a log are marked
          Not done, and you can edit them anytime.
        </span>
      </div>

      <div className="section-label">
        <h2>Your week</h2>
        <Link href={`/plan/${assignment.memberId}`}>See full plan →</Link>
      </div>

      <div className="card schedule-card">
        <div className="card-title-row">
          <div>
            <h2>Week {currentDay?.week || 1}</h2>
            <p className="card-subtitle">
              {weekDays.length
                ? `${formatPlanDate(
                    addDaysToIso(assignment.startDate, weekDays[0].planDay - 1),
                    false
                  )}–${formatPlanDate(
                    addDaysToIso(
                      assignment.startDate,
                      weekDays.at(-1)?.planDay ? weekDays.at(-1)!.planDay - 1 : 0
                    ),
                    false
                  )}`
                : "Your dated schedule"}
            </p>
          </div>
          <span className="tag">{loggedThisWeek} logged</span>
        </div>

        <div className="day-list">
          {weekDays.map((day) => {
            const date = addDaysToIso(assignment.startDate, day.planDay - 1);
            const status = dayStatus(
              assignment.startDate,
              day.planDay,
              today,
              sessions[day.planDay] || null
            );
            return (
              <Link href={`/plan/${assignment.memberId}?day=${day.planDay}`} className="day-row" key={day.id}>
                <div className="day-number">
                  {formatPlanDate(date, false)}
                  <small>Day {day.planDay}</small>
                </div>
                <div>
                  <div className="day-name">
                    {day.weekday} · {day.focus}
                  </div>
                  <div className="day-meta">
                    {day.isRecovery
                      ? day.cardio || "Recovery day"
                      : `${day.exercises.length} exercises · ${day.cardio || "No cardio target"}`}
                  </div>
                </div>
                <span className={`status-pill ${status}`}>{statusLabels[status]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="section-label">
        <h2>Your group</h2>
        <span className="tag">{dynamicMembers.length} people</span>
      </div>

      <div className="card">
        <p className="card-subtitle" style={{ marginTop: 0, marginBottom: 14 }}>
          You can open another member’s plan whenever you need to.
        </p>
        <div className="member-list">
          {dynamicMembers.map((member) => (
            <Link href={`/plan/${member.id}`} className="member-row" key={member.id}>
              <div className="member-main">
                <span className="avatar">{member.initials}</span>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.focus}</span>
                </div>
              </div>
              <div className="member-progress">
                <div className="progress-bar">
                  <span style={{ width: `${member.progress}%` }} />
                </div>
                <div className="member-progress-label">{member.progress}%</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <details className="simple-details" open>
        <summary>Recent group activity</summary>
        <div className="member-list">
          {recentActivities.map((item, index) => (
            <div className="member-row" key={`${item.name}-${index}`}>
              <div className="member-main">
                <span className="avatar">
                  {item.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.action}</span>
                </div>
              </div>
              <span className="profile-role">{item.when}</span>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
