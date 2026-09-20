"use client";

import { useEffect, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, todayIso } from "@/lib/date-utils";
import type { PlanAssignment, ScheduleDay } from "@/lib/types";
import { dayStatus, emptyWorkoutSession, markWorkoutComplete, markWorkoutSkipped, readWorkoutSession, sessionHasLogs, startWorkout, writeWorkoutSession, type LoggedSet, type WorkoutSession } from "@/lib/tracking";

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
  const [toastMessage, setToastMessage] = useState("");
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [session, setSession] = useState<WorkoutSession | null>(() => readWorkoutSession(assignment.memberId, day.planDay));
  const date = addDaysToIso(assignment.startDate, day.planDay - 1);
  const today = todayIso();
  const status = dayStatus(assignment.startDate, day.planDay, today, session);
  const [workoutOpen, setWorkoutOpen] = useState(status !== "today" && status !== "skipped");
  const isTodayIntro = status === "today" && !sessionHasLogs(session);

  useEffect(() => {
    const saved = readWorkoutSession(assignment.memberId, day.planDay);
    setSession(saved);
    if (saved && !saved.skippedAt) setWorkoutOpen(true);
    if (saved?.skipReason) setSkipReason(saved.skipReason);
  }, [assignment.memberId, day.planDay]);

  const notify = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2200);
  };

  const beginWorkout = () => {
    const started = startWorkout(assignment.memberId, day.planDay, assignment.startDate);
    setSession(started);
    setWorkoutOpen(true);
    setShowSkip(false);
  };

  const completeDay = () => {
    const completed = markWorkoutComplete(assignment.memberId, day.planDay, assignment.startDate);
    setSession(completed);
    notify("Workout saved");
  };

  const skipDay = () => {
    const skipped = markWorkoutSkipped(assignment.memberId, day.planDay, assignment.startDate, skipReason);
    setSession(skipped);
    setWorkoutOpen(false);
    setShowSkip(false);
    notify("Day marked as skipped");
  };

  const statusText = status === "done" ? "Done" : status === "in-progress" ? "In progress" : status === "not-done" ? "Not done" : status === "today" ? "Today" : status === "skipped" ? "Skipped" : "Planned";
  const statusDescription = status === "not-done" ? "No workout log was saved for this date." : status === "planned" ? "This day is still ahead." : status === "today" ? "Start when you are ready." : status === "skipped" ? `Skipped${session?.skipReason ? ` · ${session.skipReason}` : ""}.` : status === "in-progress" ? "Some activity is saved for this day." : "Completion saved for this day.";
  const showStartCard = isTodayIntro || (status === "skipped" && !workoutOpen);

  return <div className="workout-layout"><div className="card"><div className="card-title-row"><div><div className="eyebrow">Week {day.week} · Day {day.planDay} · {formatPlanDate(date)}</div><h2 style={{ marginTop: 7 }}>{day.focus}</h2><p className="card-subtitle">{formatPlanWeekday(date)} · {day.exercises.length} movements</p></div><span className={`status-pill ${status}`}>{statusText}</span></div>{showStartCard && <div className="start-workout"><div><h3>{status === "skipped" ? "Want to do this day later?" : "Ready when you are."}</h3><p>{status === "skipped" ? "You can reopen this day and add the workout later." : day.isRecovery ? "Start the day to see the recovery guidance." : "Start the day to see your exercises and log each set."}</p></div><button className="button primary" onClick={beginWorkout}>{status === "skipped" ? "Log this day" : "Start today"}</button><button className="button ghost" onClick={() => setShowSkip(true)}>Skipped / unable to train</button></div>}{workoutOpen && <><div className="exercise-list">{day.exercises.map((exercise) => { const loggableSets = exercise.sets && /^\d+$/.test(exercise.sets.trim()) ? exercise.sets : undefined; return <div className="exercise-card" key={exercise.id}><div className="exercise-head"><div><div className="exercise-name">{exercise.exercise}</div><div className="exercise-meta">{exercise.muscleGroup || "Training"}{loggableSets ? ` · ${loggableSets} sets · ${exercise.reps}` : ` · ${exercise.reps || exercise.duration || "As prescribed"}`}</div></div>{exercise.rir && <span className="tag">{exercise.rir}</span>}</div>{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}{loggableSets && <SetRows memberId={assignment.memberId} planDay={day.planDay} date={date} exerciseId={exercise.id} sets={loggableSets} onSessionChange={setSession} />}</div>; })}</div><div className="workout-actions"><button className="button primary" onClick={completeDay}>{status === "done" ? "Update workout" : "Finish workout"}</button><button className="button ghost" onClick={() => setShowSkip(true)}>Skipped / unable to train</button></div></>}{showSkip && <div className="skip-panel"><label className="field-label">Why are you skipping? <input className="set-input" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} placeholder="Travel, soreness, busy day…" /></label><div className="skip-actions"><button className="button" onClick={() => setShowSkip(false)}>Cancel</button><button className="button primary" onClick={skipDay}>Save skipped day</button></div></div>}{showToast && <div className="toast">{toastMessage}</div>}</div><div className="side-stack"><div className="card target-card"><div className="card-title-row"><div><h3>Day status</h3><p className="card-subtitle">You can open and edit past days.</p></div></div><div className="target"><span className="target-icon">01</span><div className="target-text"><strong>{statusText}</strong><span>{statusDescription}</span></div></div><div className="target"><span className="target-icon">02</span><div className="target-text"><strong>Cardio</strong><span>{day.cardio || "No cardio target"}</span></div></div><div className="target"><span className="target-icon">03</span><div className="target-text"><strong>Movement</strong><span>{day.dailyMovement || day.coachNotes || "Normal daily movement"}</span></div></div></div></div></div>;
}

export function WorkoutDay({ assignment, initialDay }: { assignment: PlanAssignment; initialDay?: number }) {
  const today = todayIso();
  const defaultDay = planDayForDate(assignment.startDate, today) || assignment.days[0]?.planDay || 1;
  const [selected, setSelected] = useState(initialDay || defaultDay);
  const day = assignment.days.find((item) => item.planDay === selected) || assignment.days[0];
  const weekDays = assignment.days.filter((item) => item.week === day?.week).slice(0, 7);
  const weeks = [...new Set(assignment.days.map((item) => item.week))];
  return <>{day && <div className="day-navigation"><div className="day-navigation-heading"><div><strong>Week {day.week}</strong><span>{formatPlanDate(addDaysToIso(assignment.startDate, weekDays[0].planDay - 1), false)}–{formatPlanDate(addDaysToIso(assignment.startDate, weekDays.at(-1)?.planDay ? weekDays.at(-1)!.planDay - 1 : 0), false)}</span></div><span className="helper-text">Choose a day</span></div><div className="week-strip">{weekDays.map((item) => { const date = addDaysToIso(assignment.startDate, item.planDay - 1); return <button key={item.id} className={`week-day ${item.planDay === selected ? "active" : ""}`} onClick={() => setSelected(item.planDay)}><span className="week-day-label">{item.weekday?.slice(0, 3)}</span><strong>{formatPlanDate(date, false).split(" ")[0]}</strong><small>{item.isRecovery ? "Rest" : "Workout"}</small></button>; })}</div><details className="all-days"><summary>Choose another week or day</summary><div className="all-day-grid">{weeks.map((week) => assignment.days.filter((item) => item.week === week).map((item) => <button key={item.id} className={`all-day-button ${item.planDay === selected ? "active" : ""}`} onClick={() => setSelected(item.planDay)}>Day {item.planDay}<span>{formatPlanDate(addDaysToIso(assignment.startDate, item.planDay - 1), false)}</span></button>))}</div></details></div>}<div style={{ height: 18 }} />{day && <DayCard assignment={assignment} day={day} />}</>;
}
