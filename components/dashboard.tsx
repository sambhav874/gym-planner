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
  const weekDays = assignment.days.filter((day) => day.week === currentDay?.week).slice(0, 7);
  const loggedThisWeek = weekDays.filter((day) => ["done", "in-progress"].includes(dayStatus(assignment.startDate, day.planDay, today, sessions[day.planDay] || null))).length;

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{formatPlanWeekday(today)}, {formatPlanDate(today)}</div><h1>Good morning, Sambhav.</h1><p>Start with today’s plan. Everything else can wait.</p></div>
        <div className="top-actions"><Link className="button ghost" href="/import">Trainer tools</Link><span className="avatar large">SJ</span></div>
      </div>

      <div className="today-card card">
        <div><div className="eyebrow">Today · Day {currentDay?.planDay}</div><h2>{currentDay?.focus || "Your plan"}</h2><p>{currentDay?.isRecovery ? "A lighter day still counts." : `${currentDay?.exercises.length || 0} movements to complete`} · <strong>{statusLabels[currentStatus]}</strong></p></div>
        <Link className="button primary" href={`/plan/sambhav?day=${currentDay?.planDay || 1}`}>{currentStatus === "done" ? "View today’s log" : currentStatus === "today" ? "Start today" : "Review today"}</Link>
      </div>

      <div className="quick-stats">
        <div className="quick-stat"><span>This week</span><strong>{loggedThisWeek} / {weekDays.length}</strong><small>days with activity</small></div>
        <div className="quick-stat"><span>Plan length</span><strong>{assignment.days.length} days</strong><small>started {formatPlanDate(assignment.startDate, false)}</small></div>
        <div className="quick-stat"><span>Current weight</span><strong>78.0 kg</strong><small>2-week average · 78.4 kg</small></div>
      </div>

      <div className="notice" style={{ marginTop: 20 }}><span className="notice-icon">i</span><span><strong>Simple rule:</strong> log the day when you finish it. Past days without a log are marked Not done, and you can edit them anytime.</span></div>

      <div className="section-label"><h2>Your week</h2><Link href="/plan/sambhav">See full plan →</Link></div>
      <div className="card schedule-card"><div className="card-title-row"><div><h2>Week {currentDay?.week || 1}</h2><p className="card-subtitle">{weekDays.length ? `${formatPlanDate(addDaysToIso(assignment.startDate, weekDays[0].planDay - 1), false)}–${formatPlanDate(addDaysToIso(assignment.startDate, weekDays.at(-1)?.planDay ? weekDays.at(-1)!.planDay - 1 : 0), false)}` : "Your dated schedule"}</p></div><span className="tag">{loggedThisWeek} logged</span></div><div className="day-list">{weekDays.map((day) => { const date = addDaysToIso(assignment.startDate, day.planDay - 1); const status = dayStatus(assignment.startDate, day.planDay, today, sessions[day.planDay] || null); return <Link href={`/plan/sambhav?day=${day.planDay}`} className="day-row" key={day.id}><div className="day-number">{formatPlanDate(date, false)}<small>Day {day.planDay}</small></div><div><div className="day-name">{day.weekday} · {day.focus}</div><div className="day-meta">{day.isRecovery ? day.cardio || "Recovery day" : `${day.exercises.length} exercises · ${day.cardio || "No cardio target"}`}</div></div><span className={`status-pill ${status}`}>{statusLabels[status]}</span></Link>; })}</div></div>

      <div className="section-label"><h2>Your group</h2><span className="tag">{members.length} people</span></div>
      <div className="card"><p className="card-subtitle" style={{ marginTop: 0, marginBottom: 14 }}>You can open another member’s plan whenever you need to.</p><div className="member-list">{members.map((member) => <Link href={`/plan/${member.id}`} className="member-row" key={member.id}><div className="member-main"><span className="avatar">{member.initials}</span><div><strong>{member.name}</strong><span>{member.focus}</span></div></div><div className="member-progress"><div className="progress-bar"><span style={{ width: `${member.progress}%` }} /></div><div className="member-progress-label">{member.progress}%</div></div></Link>)}</div></div>

      <details className="simple-details"><summary>Recent group activity</summary><div className="member-list">{activity.map((item) => <div className="member-row" key={`${item.name}-${item.when}`}><div className="member-main"><span className="avatar">{item.name.split(" ").map((word) => word[0]).join("")}</span><div><strong>{item.name}</strong><span>{item.action}</span></div></div><span className="profile-role">{item.when}</span></div>)}</div></details>
    </>
  );
}
