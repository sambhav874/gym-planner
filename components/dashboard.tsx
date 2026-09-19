import Link from "next/link";
import { activity } from "@/lib/demo-data";
import { addDaysToIso, formatPlanDate, formatPlanWeekday } from "@/lib/date-utils";
import { getAssignment, getMembers } from "@/lib/store";

export async function Dashboard() {
  const [members, assignment] = await Promise.all([getMembers(), getAssignment("sambhav")]);
  const demoDays = assignment.days;
  const currentDay = demoDays.find((day) => day.planDay === 6) || demoDays[0];
  const currentDayDate = currentDay ? addDaysToIso(assignment.startDate, currentDay.planDay - 1) : assignment.startDate;
  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">{formatPlanWeekday(currentDayDate)}, {formatPlanDate(currentDayDate)}</div><h1>Good morning, Sambhav.</h1><p>Your group is moving well. Here is what needs your attention today.</p></div>
        <div className="top-actions"><Link className="button ghost" href="/import">Trainer workspace</Link><span className="avatar large">SJ</span></div>
      </div>
      <div className="grid stats">
        <div className="card accent-card"><div className="stat-label">Today’s focus</div><div className="stat-value">{currentDay?.focus || "Plan day"}</div><div className="stat-meta good">{currentDay?.exercises.length || 0} exercises · {currentDay?.cardio || "Movement as prescribed"}</div></div>
        <div className="card"><div className="stat-label">Weekly adherence</div><div className="stat-value">72%</div><div className="stat-meta good">+8% from last week</div></div>
        <div className="card"><div className="stat-label">Current weight</div><div className="stat-value">78.0 <span style={{ fontSize: 14, color: "var(--muted)" }}>kg</span></div><div className="stat-meta">2-week average · 78.4 kg</div></div>
        <div className="card"><div className="stat-label">Group check-in</div><div className="stat-value">1 / {members.length}</div><div className="stat-meta good">Plans ready for everyone</div></div>
      </div>
      <div className="notice" style={{ marginTop: 18 }}><span className="notice-icon">!</span><span><strong>Plan updated yesterday.</strong> Week 2 now includes a slightly longer cardio target. <Link href="/plan/sambhav" style={{ textDecoration: "underline" }}>View the change</Link></span></div>
      <div className="section-label"><h2>Your week</h2><Link href="/plan/sambhav">Open full plan →</Link></div>
      <div className="grid two">
        <div className="card"><div className="card-title-row"><div><h2>Training schedule</h2><p className="card-subtitle">Week 1 · {formatPlanDate(assignment.startDate, false)}–{formatPlanDate(addDaysToIso(assignment.startDate, 6), false)}</p></div><span className="tag">3 of 7 complete</span></div><div className="day-list">{demoDays.slice(0, 7).map((day, index) => { const date = addDaysToIso(assignment.startDate, day.planDay - 1); return <Link href="/plan/sambhav" className="day-row" key={day.id}><div className="day-number">{formatPlanDate(date, false)}<small>Day {day.planDay}</small></div><div><div className="day-name">{day.weekday} · {day.focus}</div><div className="day-meta">{day.isRecovery ? day.cardio : `${day.exercises.length} exercises · ${day.cardio || "No cardio target"}`}</div></div><span className={`status-pill ${index < 3 ? "done" : index === 3 ? "next" : day.isRecovery ? "rest" : "next"}`}>{index < 3 ? "Done" : index === 3 ? "Next" : day.isRecovery ? "Recovery" : "Planned"}</span></Link>; })}</div></div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><div className="card-title-row"><div><h2>Group activity</h2><p className="card-subtitle">Open by design. See how everyone is doing.</p></div><span className="tag">Live</span></div><div className="member-list">{activity.map((item) => <div className="member-row" key={`${item.name}-${item.when}`}><div className="member-main"><span className="avatar">{item.name.split(" ").map((word) => word[0]).join("")}</span><div><strong>{item.name}</strong><span>{item.action}</span></div></div><span className="profile-role">{item.when}</span></div>)}</div></div>
          <div className="card"><div className="card-title-row"><div><h2>Group members</h2><p className="card-subtitle">Browse each person’s active plan.</p></div><span className="tag">{members.length} people</span></div><div className="member-list">{members.map((member) => <Link href={`/plan/${member.id}`} className="member-row" key={member.id}><div className="member-main"><span className="avatar">{member.initials}</span><div><strong>{member.name}</strong><span>{member.focus}</span></div></div><div className="member-progress"><div className="progress-bar"><span style={{ width: `${member.progress}%` }} /></div><div className="member-progress-label">{member.progress}%</div></div></Link>)}</div></div>
        </div>
      </div>
    </>
  );
}
