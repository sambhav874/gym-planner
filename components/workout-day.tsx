"use client";

import { useEffect, useId, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, todayIso } from "@/lib/date-utils";
import type { LoggedSetType, PlanAssignment, ScheduleDay } from "@/lib/types";
import {
  dayStatus,
  emptyWorkoutSession,
  getPreviousSessionExerciseSets,
  markWorkoutComplete,
  markWorkoutSkipped,
  readWorkoutSession,
  sessionHasLogs,
  startWorkout,
  writeWorkoutSession,
  type LoggedSet,
  type WorkoutSession,
} from "@/lib/tracking";
import { playTimerCompletionTone } from "@/lib/audio";

const blankSet = (setNumber = 1, type: LoggedSetType = "normal"): LoggedSet => ({
  setNumber,
  type,
  load: "",
  reps: "",
  rir: "",
  completed: false,
});

// ---------------------------------------------------------------------------
// Rest Timer Component
// ---------------------------------------------------------------------------

function RestTimer({
  secondsLeft,
  totalSeconds,
  isRunning,
  onStart,
  onPause,
  onReset,
  onAdjust,
  onClose,
}: {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  onStart: (seconds?: number) => void;
  onPause: () => void;
  onReset: () => void;
  onAdjust: (delta: number) => void;
  onClose: () => void;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  return (
    <div className="rest-timer-bar" role="region" aria-label="Rest timer">
      <div className="rest-timer-progress" style={{ width: `${progressPercent}%` }} />
      <div className="rest-timer-content">
        <div className="rest-timer-left">
          <span className="rest-timer-label">REST</span>
          <span className="rest-timer-digits">{display}</span>
          <div className="rest-timer-presets">
            {[45, 60, 90, 120, 180].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`rest-preset-btn ${totalSeconds === preset && isRunning ? "active" : ""}`}
                onClick={() => onStart(preset)}
              >
                {preset < 60 ? `${preset}s` : `${preset / 60}m`}
              </button>
            ))}
          </div>
        </div>

        <div className="rest-timer-controls">
          <button type="button" className="timer-adj-btn" onClick={() => onAdjust(-15)} title="Minus 15s">
            -15s
          </button>
          <button type="button" className="timer-adj-btn" onClick={() => onAdjust(15)} title="Plus 15s">
            +15s
          </button>
          {isRunning ? (
            <button type="button" className="button small" onClick={onPause}>
              Pause
            </button>
          ) : (
            <button type="button" className="button small primary" onClick={() => onStart()}>
              {secondsLeft === 0 ? "Restart" : "Resume"}
            </button>
          )}
          <button type="button" className="button ghost small" onClick={onReset} title="Reset">
            Reset
          </button>
          <button type="button" className="timer-close-btn" onClick={onClose} title="Dismiss timer">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plate & 1RM Calculator Modal
// ---------------------------------------------------------------------------

function PlateCalculatorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [targetWeight, setTargetWeight] = useState("60");
  const [barWeight, setBarWeight] = useState(20);
  const [calcLoad, setCalcLoad] = useState("80");
  const [calcReps, setCalcReps] = useState("5");

  if (!isOpen) return null;

  const target = parseFloat(targetWeight) || 0;
  const weightPerSide = Math.max(0, (target - barWeight) / 2);

  // Available plates: 25, 20, 15, 10, 5, 2.5, 1.25
  const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const platesResult: { weight: number; count: number }[] = [];
  let remaining = weightPerSide;

  for (const plate of availablePlates) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      platesResult.push({ weight: plate, count });
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }

  // 1RM Calculation via Epley formula
  const repLoad = parseFloat(calcLoad) || 0;
  const reps = parseFloat(calcReps) || 0;
  const est1RM = reps > 1 ? Math.round(repLoad * (1 + reps / 30)) : repLoad;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title-row">
          <div>
            <div className="eyebrow">Lifter Utilities</div>
            <h2 style={{ margin: "4px 0" }}>Plate & 1RM Calculator</h2>
          </div>
          <button type="button" className="button ghost small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="calc-sections">
          <div className="calc-section">
            <h3>Barbell Plate Loading</h3>
            <p className="card-subtitle">Plates to put on EACH side of the bar.</p>
            <div className="calc-inputs">
              <label className="field-label">
                Target Total (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="set-input"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="e.g. 80"
                />
              </label>
              <label className="field-label">
                Barbell Weight
                <select
                  className="set-input"
                  value={barWeight}
                  onChange={(e) => setBarWeight(Number(e.target.value))}
                >
                  <option value={20}>20 kg (Standard Men&apos;s Olympic)</option>
                  <option value={15}>15 kg (Standard Women&apos;s)</option>
                  <option value={10}>10 kg (EZ-curl / Technique bar)</option>
                </select>
              </label>
            </div>

            <div className="plate-visual-box">
              <div className="plate-summary">
                <strong>{weightPerSide} kg</strong> per side
              </div>
              <div className="plate-chips">
                {platesResult.length > 0 ? (
                  platesResult.map((p) => (
                    <span key={p.weight} className="plate-chip">
                      {p.count}× <strong>{p.weight} kg</strong>
                    </span>
                  ))
                ) : (
                  <span className="helper-text">{target <= barWeight ? "Bar only (no plates needed)" : "No matching plates"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="calc-section" style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
            <h3>One-Rep Max (1RM) Estimator</h3>
            <p className="card-subtitle">Using the Epley formula: Weight × (1 + Reps/30)</p>
            <div className="calc-inputs">
              <label className="field-label">
                Weight lifted (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="set-input"
                  value={calcLoad}
                  onChange={(e) => setCalcLoad(e.target.value)}
                  placeholder="80"
                />
              </label>
              <label className="field-label">
                Reps completed
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="set-input"
                  value={calcReps}
                  onChange={(e) => setCalcReps(e.target.value)}
                  placeholder="5"
                />
              </label>
            </div>
            <div className="est-1rm-result">
              <span>Estimated 1RM</span>
              <strong>{est1RM} kg</strong>
              <div className="rep-percentages">
                <div>90% · {Math.round(est1RM * 0.9)} kg (3-4 reps)</div>
                <div>80% · {Math.round(est1RM * 0.8)} kg (7-8 reps)</div>
                <div>70% · {Math.round(est1RM * 0.7)} kg (10-12 reps)</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button type="button" className="button primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set Rows with Dynamic Add/Remove and Mobile Numeric Keypad
// ---------------------------------------------------------------------------

function SetRows({
  memberId,
  planDay,
  date,
  exerciseId,
  exerciseName,
  sets,
  allDays,
  onSessionChange,
  onSetCompleted,
}: {
  memberId: string;
  planDay: number;
  date: string;
  exerciseId: string;
  exerciseName: string;
  sets: string;
  allDays: ScheduleDay[];
  onSessionChange: (session: WorkoutSession) => void;
  onSetCompleted: () => void;
}) {
  const count = Number.parseInt(sets, 10) || 1;
  const [rows, setRows] = useState<LoggedSet[]>(() =>
    Array.from({ length: count }, (_, idx) => blankSet(idx + 1))
  );

  // Previous session memory lookup for ghost values
  const prevSets = getPreviousSessionExerciseSets(memberId, exerciseName, planDay, allDays);

  useEffect(() => {
    const session = readWorkoutSession(memberId, planDay);
    if (session?.sets[exerciseId] && session.sets[exerciseId].length > 0) {
      setRows(session.sets[exerciseId]);
    } else {
      setRows(Array.from({ length: count }, (_, idx) => blankSet(idx + 1)));
    }
    if (session) onSessionChange(session);
  }, [count, exerciseId, memberId, onSessionChange, planDay]);

  const persist = (nextRows: LoggedSet[]) => {
    const existing = readWorkoutSession(memberId, planDay) || emptyWorkoutSession(memberId, planDay, date);
    const session = writeWorkoutSession({
      ...existing,
      date,
      sets: { ...existing.sets, [exerciseId]: nextRows },
    });
    onSessionChange(session);
  };

  const updateRow = (index: number, changes: Partial<LoggedSet>) => {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row));
    setRows(nextRows);
    persist(nextRows);

    if (changes.completed === true) {
      onSetCompleted();
    }
  };

  const addSet = () => {
    const lastRow = rows[rows.length - 1];
    const newSet: LoggedSet = {
      setNumber: rows.length + 1,
      type: "normal",
      load: lastRow?.load || "",
      reps: lastRow?.reps || "",
      rir: lastRow?.rir || "",
      completed: false,
    };
    const nextRows = [...rows, newSet];
    setRows(nextRows);
    persist(nextRows);
  };

  const removeSet = (index: number) => {
    if (rows.length <= 1) return;
    const nextRows = rows
      .filter((_, i) => i !== index)
      .map((r, i) => ({ ...r, setNumber: i + 1 }));
    setRows(nextRows);
    persist(nextRows);
  };

  const cycleType = (index: number) => {
    const current = rows[index].type || "normal";
    const order: LoggedSetType[] = ["normal", "warmup", "drop", "failure"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    updateRow(index, { type: order[nextIdx] });
  };

  const typeLabels: Record<LoggedSetType, string> = {
    normal: "",
    warmup: "W",
    drop: "D",
    failure: "F",
  };

  return (
    <div className="set-table-wrap">
      {prevSets && prevSets.length > 0 && (
        <div className="prev-session-hint">
          <span className="eyebrow">Previous session:</span>{" "}
          {prevSets.map((s, i) => `${s.load || 0}kg × ${s.reps || 0}`).join(", ")}
        </div>
      )}
      <table className="set-table">
        <thead>
          <tr>
            <th style={{ width: 48 }}>Set</th>
            <th>Load (kg)</th>
            <th>Reps</th>
            <th>RIR</th>
            <th style={{ width: 44 }} />
            <th style={{ width: 32 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const prevSet = prevSets?.[index];
            const loadPlaceholder = prevSet?.load ? `${prevSet.load}` : "kg";
            const repsPlaceholder = prevSet?.reps ? `${prevSet.reps}` : "reps";

            return (
              <tr key={index} className={row.type !== "normal" ? `set-type-${row.type}` : ""}>
                <td>
                  <button
                    type="button"
                    className="set-type-tag"
                    onClick={() => cycleType(index)}
                    title="Click to cycle type: Normal / Warmup / Drop / Failure"
                  >
                    {typeLabels[row.type || "normal"] || `${index + 1}`}
                  </button>
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className="set-input"
                    aria-label={`${exerciseName} set ${index + 1} load`}
                    value={row.load}
                    onChange={(event) => updateRow(index, { load: event.target.value })}
                    placeholder={loadPlaceholder}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="set-input"
                    aria-label={`${exerciseName} set ${index + 1} reps`}
                    value={row.reps}
                    onChange={(event) => updateRow(index, { reps: event.target.value })}
                    placeholder={repsPlaceholder}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="set-input"
                    aria-label={`${exerciseName} set ${index + 1} RIR`}
                    value={row.rir}
                    onChange={(event) => updateRow(index, { rir: event.target.value })}
                    placeholder="2"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={`check-button ${row.completed ? "checked" : ""}`}
                    onClick={() => updateRow(index, { completed: !row.completed })}
                    aria-label={`Mark set ${index + 1} complete`}
                  >
                    {row.completed ? "✓" : ""}
                  </button>
                </td>
                <td>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="delete-set-btn"
                      onClick={() => removeSet(index)}
                      title="Remove set"
                      aria-label="Remove set"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="set-table-footer">
        <button type="button" className="button ghost small" onClick={addSet}>
          + Add set
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Card Component
// ---------------------------------------------------------------------------

function DayCard({
  assignment,
  day,
  onNavigateDay,
}: {
  assignment: PlanAssignment;
  day: ScheduleDay;
  onNavigateDay: (dayNumber: number) => void;
}) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [showPlateCalc, setShowPlateCalc] = useState(false);

  // Rest Timer State
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(90);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(90);
  const [timerIsRunning, setTimerIsRunning] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);

  const [session, setSession] = useState<WorkoutSession | null>(() =>
    readWorkoutSession(assignment.memberId, day.planDay)
  );

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

  // Timer Tick effect
  useEffect(() => {
    if (!timerIsRunning) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerIsRunning(false);
          playTimerCompletionTone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerIsRunning]);

  const handleStartTimer = (seconds?: number) => {
    const dur = seconds ?? (timerSecondsLeft > 0 ? timerSecondsLeft : 90);
    setTimerTotalSeconds(dur);
    setTimerSecondsLeft(dur);
    setTimerIsRunning(true);
    setTimerVisible(true);
  };

  const handlePauseTimer = () => {
    setTimerIsRunning(false);
  };

  const handleResetTimer = () => {
    setTimerIsRunning(false);
    setTimerSecondsLeft(timerTotalSeconds);
  };

  const handleAdjustTimer = (delta: number) => {
    setTimerSecondsLeft((prev) => Math.max(0, prev + delta));
    setTimerTotalSeconds((prev) => Math.max(prev, prev + delta));
  };

  const handleSetCompleted = () => {
    // Auto-trigger rest timer on checking a set!
    handleStartTimer(90);
  };

  const notify = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2400);
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
    notify("Workout saved and marked complete!");
  };

  const skipDay = () => {
    const skipped = markWorkoutSkipped(assignment.memberId, day.planDay, assignment.startDate, skipReason);
    setSession(skipped);
    setWorkoutOpen(false);
    setShowSkip(false);
    notify("Day marked as skipped");
  };

  const statusText =
    status === "done"
      ? "Done"
      : status === "in-progress"
      ? "In progress"
      : status === "not-done"
      ? "Not done"
      : status === "today"
      ? "Today"
      : status === "skipped"
      ? "Skipped"
      : "Planned";

  const statusDescription =
    status === "not-done"
      ? "No workout log was saved for this date."
      : status === "planned"
      ? "This day is still ahead."
      : status === "today"
      ? "Start when you are ready."
      : status === "skipped"
      ? `Skipped${session?.skipReason ? ` · ${session.skipReason}` : ""}.`
      : status === "in-progress"
      ? "Some activity is saved for this day."
      : "Completion saved for this day.";

  const showStartCard = isTodayIntro || (status === "skipped" && !workoutOpen);
  const prevDay = day.planDay > 1 ? day.planDay - 1 : null;
  const nextDay = day.planDay < assignment.days.length ? day.planDay + 1 : null;

  const [viewMode, setViewMode] = useState<"flow" | "sheet">("flow");
  const [activeMovementIndex, setActiveMovementIndex] = useState(0);

  // Clamp movement index if exercises change
  const activeExercise = day.exercises[activeMovementIndex] || day.exercises[0];
  const completedMovementsCount = day.exercises.filter((ex) => {
    const s = session?.sets[ex.id];
    return s && s.length > 0 && s.every((row) => row.completed);
  }).length;

  return (
    <div className="workout-layout">
      <div className="card">
        <div className="card-title-row">
          <div>
            <div className="eyebrow">
              Week {day.week} · Day {day.planDay} of {assignment.days.length} · {formatPlanDate(date)}
            </div>
            <h2 style={{ marginTop: 7 }}>{day.focus}</h2>
            <p className="card-subtitle">
              {formatPlanWeekday(date)} · {day.exercises.length} movements
            </p>
          </div>
          <div className="card-actions-right">
            <button
              type="button"
              className="button ghost small"
              onClick={() => setShowPlateCalc(true)}
              title="Open Barbell Plate & 1RM Calculator"
            >
              Plate Calc
            </button>
            <span className={`status-pill ${status}`}>{statusText}</span>
          </div>
        </div>

        {showStartCard && (
          <div className="start-workout">
            <div>
              <h3>{status === "skipped" ? "Want to do this day later?" : "Ready when you are."}</h3>
              <p>
                {status === "skipped"
                  ? "You can reopen this day and add the workout later."
                  : day.isRecovery
                  ? "Start the day to review your active recovery and mobility guidance."
                  : "Start the day to begin your step-by-step workout flow with the rest timer."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="button primary" onClick={beginWorkout}>
                {status === "skipped" ? "Log this day" : "Start workout flow →"}
              </button>
              <button type="button" className="button ghost" onClick={() => setShowSkip(true)}>
                Skipped / unable to train
              </button>
            </div>
          </div>
        )}

        {workoutOpen && (
          <>
            {/* View Mode Toggle: Focus Flow vs Full Sheet */}
            <div className="view-mode-toggle-row">
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${viewMode === "flow" ? "active" : ""}`}
                  onClick={() => setViewMode("flow")}
                >
                  <span className="mode-icon">⚡</span> Focus Flow
                </button>
                <button
                  type="button"
                  className={`segment-btn ${viewMode === "sheet" ? "active" : ""}`}
                  onClick={() => setViewMode("sheet")}
                >
                  <span>≡</span> Full Sheet ({day.exercises.length})
                </button>
              </div>
            </div>

            {viewMode === "flow" ? (
              /* Guided Flow: One movement at a time for mobile simplicity */
              <div className="workout-flow-container">
                <div className="flow-stepper-header">
                  <div className="flow-stepper-meta">
                    <span className="eyebrow">
                      Movement {activeMovementIndex + 1} of {day.exercises.length}
                    </span>
                    <span className="flow-completion-badge">
                      {completedMovementsCount} / {day.exercises.length} complete
                    </span>
                  </div>

                  <div className="flow-progress-track">
                    <div
                      className="flow-progress-fill"
                      style={{
                        width: `${Math.round(((activeMovementIndex + 1) / day.exercises.length) * 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flow-movement-chips">
                    {day.exercises.map((ex, idx) => {
                      const exSets = session?.sets[ex.id];
                      const isDone = exSets && exSets.length > 0 && exSets.every((s) => s.completed);
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          className={`movement-chip ${idx === activeMovementIndex ? "active" : ""} ${
                            isDone ? "completed" : ""
                          }`}
                          onClick={() => setActiveMovementIndex(idx)}
                        >
                          <span className="chip-num">{isDone ? "✓" : idx + 1}</span>
                          <span className="chip-name">{ex.exercise}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeExercise && (
                  <div className="active-movement-card">
                    <div className="movement-hero">
                      <div>
                        <div className="exercise-name">{activeExercise.exercise}</div>
                        <div className="exercise-meta">
                          {activeExercise.muscleGroup || "Training"}
                          {` · ${activeExercise.sets || "3"} sets · ${
                            activeExercise.reps || activeExercise.duration || "As prescribed"
                          }`}
                        </div>
                      </div>
                      {activeExercise.rir && <span className="tag">{activeExercise.rir}</span>}
                    </div>

                    {activeExercise.notes && (
                      <div className="coach-cue-banner">
                        <span className="coach-cue-icon">💡</span>
                        <span>{activeExercise.notes}</span>
                      </div>
                    )}

                    <SetRows
                      memberId={assignment.memberId}
                      planDay={day.planDay}
                      date={date}
                      exerciseId={activeExercise.id}
                      exerciseName={activeExercise.exercise}
                      sets={
                        activeExercise.sets && /^\d+$/.test(activeExercise.sets.trim())
                          ? activeExercise.sets
                          : "3"
                      }
                      allDays={assignment.days}
                      onSessionChange={setSession}
                      onSetCompleted={handleSetCompleted}
                    />
                  </div>
                )}

                <div className="flow-nav-controls">
                  <button
                    type="button"
                    className="button ghost"
                    disabled={activeMovementIndex === 0}
                    onClick={() => setActiveMovementIndex((prev) => Math.max(0, prev - 1))}
                  >
                    ← Previous
                  </button>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => handleStartTimer(90)}
                      title="Start 90s rest timer"
                    >
                      Rest 90s
                    </button>
                    {activeMovementIndex < day.exercises.length - 1 ? (
                      <button
                        type="button"
                        className="button primary"
                        onClick={() =>
                          setActiveMovementIndex((prev) =>
                            Math.min(day.exercises.length - 1, prev + 1)
                          )
                        }
                      >
                        Next Movement →
                      </button>
                    ) : (
                      <button type="button" className="button primary" onClick={completeDay}>
                        {status === "done" ? "Update workout" : "Finish workout ✓"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Sheet Mode: All exercises stacked */
              <div className="exercise-list">
                {day.exercises.map((exercise) => {
                  const loggableSets =
                    exercise.sets && /^\d+$/.test(exercise.sets.trim()) ? exercise.sets : "3";

                  return (
                    <div className="exercise-card" key={exercise.id}>
                      <div className="exercise-head">
                        <div>
                          <div className="exercise-name">{exercise.exercise}</div>
                          <div className="exercise-meta">
                            {exercise.muscleGroup || "Training"}
                            {` · ${exercise.sets || "3"} sets · ${
                              exercise.reps || exercise.duration || "As prescribed"
                            }`}
                          </div>
                        </div>
                        {exercise.rir && <span className="tag">{exercise.rir}</span>}
                      </div>
                      {exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}
                      <SetRows
                        memberId={assignment.memberId}
                        planDay={day.planDay}
                        date={date}
                        exerciseId={exercise.id}
                        exerciseName={exercise.exercise}
                        sets={loggableSets}
                        allDays={assignment.days}
                        onSessionChange={setSession}
                        onSetCompleted={handleSetCompleted}
                      />
                    </div>
                  );
                })}

                <div className="workout-actions">
                  <button type="button" className="button primary" onClick={completeDay}>
                    {status === "done" ? "Update workout log" : "Finish workout"}
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => handleStartTimer(90)}
                    title="Start 90s rest timer"
                  >
                    Start rest timer
                  </button>
                  <button type="button" className="button ghost" onClick={() => setShowSkip(true)}>
                    Mark skipped
                  </button>
                </div>
              </div>
            )}
          </>
        )}


        {showSkip && (
          <div className="skip-panel">
            <label className="field-label">
              Why are you skipping?
              <input
                className="set-input"
                value={skipReason}
                onChange={(event) => setSkipReason(event.target.value)}
                placeholder="Travel, soreness, busy schedule…"
              />
            </label>
            <div className="skip-actions">
              <button type="button" className="button" onClick={() => setShowSkip(false)}>
                Cancel
              </button>
              <button type="button" className="button primary" onClick={skipDay}>
                Save skipped day
              </button>
            </div>
          </div>
        )}

        {showToast && <div className="toast">{toastMessage}</div>}

        <div className="day-pager">
          {prevDay ? (
            <button type="button" className="button ghost small" onClick={() => onNavigateDay(prevDay)}>
              ← Day {prevDay}
            </button>
          ) : (
            <span />
          )}
          {nextDay ? (
            <button type="button" className="button ghost small" onClick={() => onNavigateDay(nextDay)}>
              Day {nextDay} →
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="side-stack">
        <div className="card target-card">
          <div className="card-title-row">
            <div>
              <h3>Day status</h3>
              <p className="card-subtitle">You can open and edit any date.</p>
            </div>
          </div>
          <div className="target">
            <span className="target-icon">01</span>
            <div className="target-text">
              <strong>{statusText}</strong>
              <span>{statusDescription}</span>
            </div>
          </div>
          <div className="target">
            <span className="target-icon">02</span>
            <div className="target-text">
              <strong>Cardio target</strong>
              <span>{day.cardio || "No cardio target"}</span>
            </div>
          </div>
          <div className="target">
            <span className="target-icon">03</span>
            <div className="target-text">
              <strong>Daily movement</strong>
              <span>{day.dailyMovement || day.coachNotes || "Normal daily movement (7,000+ steps)"}</span>
            </div>
          </div>
        </div>

        <div className="card print-sheet-card">
          <h3>Physical Training Sheet</h3>
          <p className="card-subtitle">Prefer training without looking at a screen?</p>
          <button type="button" className="button small" onClick={() => window.print()}>
            Print today&apos;s sheet
          </button>
        </div>
      </div>

      {timerVisible && (
        <RestTimer
          secondsLeft={timerSecondsLeft}
          totalSeconds={timerTotalSeconds}
          isRunning={timerIsRunning}
          onStart={handleStartTimer}
          onPause={handlePauseTimer}
          onReset={handleResetTimer}
          onAdjust={handleAdjustTimer}
          onClose={() => setTimerVisible(false)}
        />
      )}

      <PlateCalculatorModal isOpen={showPlateCalc} onClose={() => setShowPlateCalc(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkoutDay Main Container
// ---------------------------------------------------------------------------

export function WorkoutDay({
  assignment,
  initialDay,
}: {
  assignment: PlanAssignment;
  initialDay?: number;
}) {
  const today = todayIso();
  const defaultDay = planDayForDate(assignment.startDate, today) || assignment.days[0]?.planDay || 1;
  const [selected, setSelected] = useState(initialDay || defaultDay);
  const day = assignment.days.find((item) => item.planDay === selected) || assignment.days[0];
  const weekDays = assignment.days.filter((item) => item.week === day?.week).slice(0, 7);
  const weeks = [...new Set(assignment.days.map((item) => item.week))];

  return (
    <>
      {day && (
        <div className="day-navigation">
          <div className="day-navigation-heading">
            <div>
              <strong>Week {day.week}</strong>
              <span>
                {formatPlanDate(addDaysToIso(assignment.startDate, weekDays[0].planDay - 1), false)}–
                {formatPlanDate(
                  addDaysToIso(
                    assignment.startDate,
                    weekDays.at(-1)?.planDay ? weekDays.at(-1)!.planDay - 1 : 0
                  ),
                  false
                )}
              </span>
            </div>
            <span className="helper-text">Choose a day</span>
          </div>

          <div className="week-strip">
            {weekDays.map((item) => {
              const date = addDaysToIso(assignment.startDate, item.planDay - 1);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`week-day ${item.planDay === selected ? "active" : ""}`}
                  onClick={() => setSelected(item.planDay)}
                >
                  <span className="week-day-label">{item.weekday?.slice(0, 3)}</span>
                  <strong>{formatPlanDate(date, false).split(" ")[0]}</strong>
                  <small>{item.isRecovery ? "Rest" : "Workout"}</small>
                </button>
              );
            })}
          </div>

          <details className="all-days">
            <summary>Choose another week or day</summary>
            <div className="all-day-grid">
              {weeks.map((week) =>
                assignment.days
                  .filter((item) => item.week === week)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`all-day-button ${item.planDay === selected ? "active" : ""}`}
                      onClick={() => setSelected(item.planDay)}
                    >
                      Day {item.planDay}
                      <span>{formatPlanDate(addDaysToIso(assignment.startDate, item.planDay - 1), false)}</span>
                    </button>
                  ))
              )}
            </div>
          </details>
        </div>
      )}

      <div style={{ height: 18 }} />

      {day && <DayCard assignment={assignment} day={day} onNavigateDay={setSelected} />}
    </>
  );
}
