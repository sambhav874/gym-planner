"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { activity } from "@/lib/demo-data";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, todayIso } from "@/lib/date-utils";
import type { Member, PlanAssignment } from "@/lib/types";
import { dayStatus, readWorkoutSession, type DayStatus, type WorkoutSession } from "@/lib/tracking";

const statusLabels: Record<DayStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  "not-done": "Not done",
  today: "Today",
  planned: "Planned",
};

export function Dashboard({ members, assignment }: { members: Member[]; assignment: PlanAssignment }) {
  const today = todayIso();
  const [sessions, setSessions] = useState<Record<number, WorkoutSession | null>>({});

  useEffect(() => {
    setSessions(Object.fromEntries(assignment.days.map((day) => [day.planDay, readWorkoutSession(assignment.memberId, day.planDay)])));
  }, [assignment.days, assignment.memberId]);

  const currentPlanDay = useMemo(() => {
    const planDay = planDayForDate(assignment.startDate, today);
    if (planDay && assignment.days.some((day) => day.planDay === planDay)) return planDay;
    return today < assignment.startDate ? assignment.days[0]?.planDay : assignment.days.at(-1)?.planDay;
  }, [assignment.days, assignment.startDate, today]);
  const currentDay = assignment.days.find((day) => day.planDay === currentPlanDay) || assignment.days[0];
  const currentStatus = currentDay ? dayStatus(assignment.startDate, currentDay.planDay, today, sessions[currentDay.planDay] || null) : "planned";

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{formatPlanWeekday(today)}, {formatPlanDate(today)}</div><h1>Good morning, Sambhav.</h1><p>Your group is moving well. Here is what needs your attention today.</p></div>
        <div className="top-actions"><Link className="button ghost" href="/import">Trainer workspace</Link><span className="avatar large">SJ</span></div>
      </div>
      <div className="grid stats">
        <div className="card accent-card"><div className="stat-label">Today’s focus · Day {currentDay?.planDay}</div><div className="stat-value">{currentDay?.focus || "Plan day"}</div><div className="stat-meta good">{statusLabels[currentStatus]} · {currentDay?.exercises.length || 0} movements</div></div>
        <div className="card"><div className="stat-label">Weekly adherence</div><div className="stat-value">72%</div><div className="stat-meta good">+8% from last week</div></div>
        <div className="card"><div className="stat-label">Current weight</div><div className="stat-value">78.0 <span style={{ fontSize: 14, color: "var(--muted)" }}>kg</span></div><div className="stat-meta">2-week average · 78.4 kg</div></div>
        <div className="card"><div className="stat-label">Today</div><div className="stat-value">{formatPlanDate(today, false)}</div><div className="stat-meta">Past unlogged days are not done</div></div>
      </div>
      <div className="notice" style={{ marginTop: 18 }}><span className="notice-icon">!</span><span><strong>Day-based tracking is on.</strong> Past dates without a saved completion are marked Not done. Open any dated day to log or edit it.</span></div>
      <div className="section-label"><h2>Your plan</h2><Link href="/plan/sambhav">Open full plan →</Link></div>
      <div className="grid two">
        <div className="card"><div className="card-title-row"><div><h2>Training schedule</h2><p className="card-subtitle">Week 1 · {formatPlanDate(assignment.startDate, false)}–{formatPlanDate(addDaysToIso(assignment.startDate, 6), false)}</p></div><span className="tag">{assignment.days.filter((day) => dayStatus(assignment.startDate, day.planDay, today, sessions[day.planDay] || null) === "done").length} logged</span></div><div className="day-list">{assignment.days.slice(0, 7).map((day) => { const date = addDaysToIso(assignment.startDate, day.planDay - 1); const status = dayStatus(assignment.startDate, day.planDay, today, sessions[day.planDay] || null); return <Link href={`/plan/sambhav?day=${day.planDay}`} className="day-row" key={day.id}><div className="day-number">{formatPlanDate(date, false)}<small>Day {day.planDay}</small></div><div><div className="day-name">{day.weekday} · {day.focus}</div><div className="day-meta">{day.isRecovery ? day.cardio || "Recovery day" : `${day.exercises.length} exercises · ${day.cardio || "No cardio target"}`}</div></div><span className={`status-pill ${status}`}>{statusLabels[status]}</span></Link>; })}</div></div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><div className="card-title-row"><div><h2>Group activity</h2><p className="card-subtitle">Open by design. See how everyone is doing.</p></div><span className="tag">Live</span></div><div className="member-list">{activity.map((item) => <div className="member-row" key={`${item.name}-${item.when}`}><div className="member-main"><span className="avatar">{item.name.split(" ").map((word) => word[0]).join("")}</span><div><strong>{item.name}</strong><span>{item.action}</span></div></div><span className="profile-role">{item.when}</span></div>)}</div></div>
          <div className="card"><div className="card-title-row"><div><h2>Group members</h2><p className="card-subtitle">Browse each person’s active plan.</p></div><span className="tag">{members.length} people</span></div><div className="member-list">{members.map((member) => <Link href={`/plan/${member.id}`} className="member-row" key={member.id}><div className="member-main"><span className="avatar">{member.initials}</span><div><strong>{member.name}</strong><span>{member.focus}</span></div></div><div className="member-progress"><div className="progress-bar"><span style={{ width: `${member.progress}%` }} /></div><div className="member-progress-label">{member.progress}%</div></div></Link>)}</div></div>
        </div>
      </div>
    </>
  );
}
