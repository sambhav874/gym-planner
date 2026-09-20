"use client";

import { useEffect, useMemo, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, todayIso } from "@/lib/date-utils";
import type { PlanAssignment, ScheduleDay } from "@/lib/types";
import { dayStatus, emptyWorkoutSession, markWorkoutComplete, readWorkoutSession, writeWorkoutSession, type LoggedSet, type WorkoutSession } from "@/lib/tracking";

const blankSet = (): LoggedSet => ({ load: "", reps: "", rir: "", completed: false });

function SetRows({ memberId, planDay, date, exerciseId, sets, onSessionChange }: { memberId: string; planDay: number; date: string; exerciseId: string; sets: string; onSessionChange: (session: WorkoutSession) => void }) {
  const count = Number.parseInt(sets, 10) || 1;
  const [rows, setRows] = useState<LoggedSet[]>(() => Array.from({ length: count }, blankSet));

  useEffect(() => {
    const session = readWorkoutSession(memberId, planDay);
    if (session?.sets[exerciseId]) setRows(Array.from({ length: count }, (_, index) => session.sets[exerciseId][index] || blankSet()));
    if (session) onSessionChange(session);
  }, [count, exerciseId, memberId, onSessionChange, planDay]);

  const persist = (nextRows: LoggedSet[]) => {
    const existing = readWorkoutSession(memberId, planDay) || emptyWorkoutSession(memberId, planDay, date);
    const session = writeWorkoutSession({ ...existing, date, sets: { ...existing.sets, [exerciseId]: nextRows } });
    onSessionChange(session);
  };

  const updateRow = (index: number, changes: Partial<LoggedSet>) => {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row);
    setRows(nextRows);
    persist(nextRows);
  };

  return <table className="set-table"><thead><tr><th>Set</th><th>Load</th><th>Reps</th><th>RIR</th><th /></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} load`} value={row.load} onChange={(event) => updateRow(index, { load: event.target.value })} placeholder="kg" /></td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} reps`} value={row.reps} onChange={(event) => updateRow(index, { reps: event.target.value })} placeholder="reps" /></td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} RIR`} value={row.rir} onChange={(event) => updateRow(index, { rir: event.target.value })} placeholder="2" /></td><td><button className={`check-button ${row.completed ? "checked" : ""}`} onClick={() => updateRow(index, { completed: !row.completed })} aria-label={`Mark set ${index + 1} complete`}>{row.completed ? "✓" : ""}</button></td></tr>)}</tbody></table>;
}

function DayCard({ assignment, day }: { assignment: PlanAssignment; day: ScheduleDay }) {
  const [showToast, setShowToast] = useState(false);
  const [session, setSession] = useState<WorkoutSession | null>(() => readWorkoutSession(assignment.memberId, day.planDay));
  const date = addDaysToIso(assignment.startDate, day.planDay - 1);
  const today = todayIso();
  const status = dayStatus(assignment.startDate, day.planDay, today, session);
  const exercises = useMemo(() => day.exercises.filter((exercise) => exercise.sets !== "—"), [day.exercises]);

  useEffect(() => {
    setSession(readWorkoutSession(assignment.memberId, day.planDay));
  }, [assignment.memberId, day.planDay]);

  const completeDay = () => {
    const completed = markWorkoutComplete(assignment.memberId, day.planDay, assignment.startDate);
    setSession(completed);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2200);
  };

  const statusText = status === "done" ? "Done" : status === "in-progress" ? "In progress" : status === "not-done" ? "Not done" : status === "today" ? "Today" : "Planned";
  return <div className="workout-layout"><div className="card"><div className="card-title-row"><div><div className="eyebrow">Week {day.week} · Day {day.planDay} · {formatPlanDate(date)}</div><h2 style={{ marginTop: 7 }}>{day.focus}</h2><p className="card-subtitle">{formatPlanWeekday(date)} · {day.exercises.length} movements</p></div><span className={`status-pill ${status}`}>{statusText}</span></div><div className="exercise-list">{day.exercises.map((exercise) => <div className="exercise-card" key={exercise.id}><div className="exercise-head"><div><div className="exercise-name">{exercise.exercise}</div><div className="exercise-meta">{exercise.muscleGroup || "Training"}{exercise.sets && exercise.sets !== "—" ? ` · ${exercise.sets} sets · ${exercise.reps}` : ` · ${exercise.reps || exercise.duration || "As prescribed"}`}</div></div>{exercise.rir && <span className="tag">{exercise.rir}</span>}</div>{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}{exercise.sets && exercise.sets !== "—" && <SetRows memberId={assignment.memberId} planDay={day.planDay} date={date} exerciseId={exercise.id} sets={exercise.sets} onSessionChange={setSession} />}</div>)}</div><button className="button primary" style={{ marginTop: 17, width: "100%" }} onClick={completeDay}>{status === "done" ? "Update day log" : "Mark day complete"}</button>{showToast && <div className="toast">Workout saved for {formatPlanDate(date, false)}.</div>}</div><div className="side-stack"><div className="card target-card"><div className="card-title-row"><div><h3>Day status</h3><p className="card-subtitle">You can open and edit past days.</p></div></div><div className="target"><span className="target-icon">01</span><div className="target-text"><strong>{statusText}</strong><span>{status === "not-done" ? "No workout log was saved for this date." : status === "planned" ? "This day is still ahead." : "This day has saved activity."}</span></div></div><div className="target"><span className="target-icon">02</span><div className="target-text"><strong>Cardio</strong><span>{day.cardio || "No cardio target"}</span></div></div><div className="target"><span className="target-icon">03</span><div className="target-text"><strong>Movement</strong><span>{day.dailyMovement || day.coachNotes || "Normal daily movement"}</span></div></div></div></div></div>;
}

export function WorkoutDay({ assignment, initialDay }: { assignment: PlanAssignment; initialDay?: number }) {
  const today = todayIso();
  const defaultDay = planDayForDate(assignment.startDate, today) || assignment.days[0]?.planDay || 1;
  const [selected, setSelected] = useState(initialDay || defaultDay);
  const day = assignment.days.find((item) => item.planDay === selected) || assignment.days[0];
  return <><div className="filter-row">{assignment.days.map((item) => { const date = addDaysToIso(assignment.startDate, item.planDay - 1); return <button key={item.id} className={`filter ${item.planDay === selected ? "active" : ""}`} onClick={() => setSelected(item.planDay)}>D{item.planDay}<span style={{ opacity: .65 }}> · {formatPlanDate(date, false)}</span></button>; })}</div><div style={{ height: 18 }} />{day && <DayCard assignment={assignment} day={day} />}</>;
}
