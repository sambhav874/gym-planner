"use client";

import { useEffect, useMemo, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday } from "@/lib/date-utils";
import type { PlanAssignment, ScheduleDay } from "@/lib/types";

function SetRows({ exerciseId, sets }: { exerciseId: string; sets: string }) {
  const count = Number.parseInt(sets, 10) || 1;
  const [checked, setChecked] = useState<boolean[]>(Array.from({ length: count }, () => false));
  const [values, setValues] = useState<string[]>(Array.from({ length: count }, () => ""));
  useEffect(() => {
    const saved = window.localStorage.getItem(`formwork-log-${exerciseId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { checked: boolean[]; values: string[] };
        setChecked(parsed.checked);
        setValues(parsed.values);
      } catch { /* Ignore stale local data. */ }
    }
  }, [exerciseId]);
  const save = (nextChecked: boolean[], nextValues: string[]) => window.localStorage.setItem(`formwork-log-${exerciseId}`, JSON.stringify({ checked: nextChecked, values: nextValues }));
  return <table className="set-table"><thead><tr><th>Set</th><th>Load</th><th>Reps</th><th>RIR</th><th /></tr></thead><tbody>{Array.from({ length: count }, (_, index) => <tr key={index}><td>{index + 1}</td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} load`} value={values[index]} onChange={(event) => { const next = [...values]; next[index] = event.target.value; setValues(next); save(checked, next); }} placeholder="kg" /></td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} reps`} placeholder="reps" /></td><td><input className="set-input" aria-label={`${exerciseId} set ${index + 1} RIR`} placeholder="2" /></td><td><button className={`check-button ${checked[index] ? "checked" : ""}`} onClick={() => { const next = [...checked]; next[index] = !next[index]; setChecked(next); save(next, values); }} aria-label={`Mark set ${index + 1} complete`}>{checked[index] ? "✓" : ""}</button></td></tr>)}</tbody></table>;
}

function DayCard({ day, startDate }: { day: ScheduleDay; startDate: string }) {
  const [showToast, setShowToast] = useState(false);
  const exercises = useMemo(() => day.exercises.filter((exercise) => exercise.sets !== "—"), [day.exercises]);
  const date = addDaysToIso(startDate, day.planDay - 1);
  return <div className="workout-layout"><div className="card"><div className="card-title-row"><div><div className="eyebrow">Week {day.week} · Day {day.planDay} · {formatPlanDate(date)}</div><h2 style={{ marginTop: 7 }}>{day.focus}</h2><p className="card-subtitle">{formatPlanWeekday(date)} · {day.exercises.length} movements</p></div><span className={`status-pill ${day.isRecovery ? "rest" : "next"}`}>{day.isRecovery ? "Recovery" : "Planned"}</span></div><div className="exercise-list">{day.exercises.map((exercise) => <div className="exercise-card" key={exercise.id}><div className="exercise-head"><div><div className="exercise-name">{exercise.exercise}</div><div className="exercise-meta">{exercise.muscleGroup || "Training"}{exercise.sets && exercise.sets !== "—" ? ` · ${exercise.sets} sets · ${exercise.reps}` : ` · ${exercise.reps || exercise.duration || "As prescribed"}`}</div></div>{exercise.rir && <span className="tag">{exercise.rir}</span>}</div>{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}{exercise.sets && exercise.sets !== "—" && <SetRows exerciseId={exercise.id} sets={exercise.sets} />}</div>)}</div><button className="button primary" style={{ marginTop: 17, width: "100%" }} onClick={() => { setShowToast(true); window.setTimeout(() => setShowToast(false), 2200); }}>Mark day complete</button>{showToast && <div className="toast">Workout saved to your progress.</div>}</div><div className="side-stack"><div className="card target-card"><div className="card-title-row"><div><h3>Today’s targets</h3><p className="card-subtitle">Keep the small things visible.</p></div></div><div className="target"><span className="target-icon">01</span><div className="target-text"><strong>Cardio</strong><span>{day.cardio || "No cardio target"}</span></div></div><div className="target"><span className="target-icon">02</span><div className="target-text"><strong>Movement</strong><span>{day.dailyMovement || "Normal daily movement"}</span></div></div><div className="target"><span className="target-icon">03</span><div className="target-text"><strong>Coach note</strong><span>{day.coachNotes || "Stay consistent and controlled."}</span></div></div></div></div></div>;
}

export function WorkoutDay({ assignment }: { assignment: PlanAssignment }) {
  const [selected, setSelected] = useState(assignment.days[0]?.planDay || 1);
  const day = assignment.days.find((item) => item.planDay === selected) || assignment.days[0];
  return <><div className="filter-row">{assignment.days.map((item) => { const date = addDaysToIso(assignment.startDate, item.planDay - 1); return <button key={item.id} className={`filter ${item.planDay === selected ? "active" : ""}`} onClick={() => setSelected(item.planDay)}>D{item.planDay}<span style={{ opacity: .65 }}> · {formatPlanDate(date, false)}</span></button>; })}</div><div style={{ height: 18 }} />{day && <DayCard day={day} startDate={assignment.startDate} />}</>;
}
