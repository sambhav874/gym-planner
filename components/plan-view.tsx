"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDaysToIso, formatPlanDate, formatPlanWeekday, planDayForDate, planEndDate, todayIso } from "@/lib/date-utils";
import type { DietDay, PlanAssignment } from "@/lib/types";
import { WorkoutDay } from "./workout-day";
import { resolveActiveAssignment } from "@/lib/client-plan";
import { readDietLog, writeDietLog } from "@/lib/tracking";

export function PlanView({
  assignment: serverAssignment,
  isOwner,
  initialDay,
}: {
  assignment: PlanAssignment;
  isOwner: boolean;
  initialDay?: number;
}) {
  const [activePlan, setActivePlan] = useState<PlanAssignment>(serverAssignment);
  const [tab, setTab] = useState<"workout" | "diet" | "guidance">("workout");
  const today = todayIso();
  const defaultDay = planDayForDate(serverAssignment.startDate, today) || 1;
  const [selectedDietDay, setSelectedDietDay] = useState(initialDay || defaultDay);

  // Check for client-side published plan override (from /import)
  useEffect(() => {
    setActivePlan(resolveActiveAssignment(serverAssignment));

    const handlePlanUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PlanAssignment>;
      if (customEvent.detail && customEvent.detail.memberId === serverAssignment.memberId) {
        setActivePlan(customEvent.detail);
      }
    };

    window.addEventListener("formwork-plan-updated", handlePlanUpdate);
    return () => window.removeEventListener("formwork-plan-updated", handlePlanUpdate);
  }, [serverAssignment]);

  const assignment = activePlan;
  const endDate = planEndDate(assignment.startDate, assignment.days.length);

  // Diet Day Matching
  const currentDietDate = addDaysToIso(assignment.startDate, selectedDietDay - 1);
  const dietDayMatch: DietDay | undefined =
    assignment.dietDays.find((d) => d.day === selectedDietDay) ||
    assignment.dietDays[(selectedDietDay - 1) % (assignment.dietDays.length || 1)] ||
    assignment.dietDays[0];

  // Interactive Diet & Hydration Checklist
  const [dietLog, setDietLog] = useState(() => readDietLog(currentDietDate));

  useEffect(() => {
    setDietLog(readDietLog(currentDietDate));
  }, [currentDietDate]);

  const toggleMealCheck = (mealName: string) => {
    const currentMeals = dietLog.completedMeals || [];
    const isCompleted = currentMeals.includes(mealName);
    const updatedMeals = isCompleted
      ? currentMeals.filter((m) => m !== mealName)
      : [...currentMeals, mealName];

    const updated = writeDietLog({
      ...dietLog,
      date: currentDietDate,
      completedMeals: updatedMeals,
    });
    setDietLog(updated);
  };

  const addWater = (amountLiters: number) => {
    const nextAmount = Math.max(0, Math.round(((dietLog.waterLiters || 0) + amountLiters) * 10) / 10);
    const updated = writeDietLog({
      ...dietLog,
      date: currentDietDate,
      waterLiters: nextAmount,
    });
    setDietLog(updated);
  };

  const meals = [
    { name: "Breakfast", content: dietDayMatch?.breakfast },
    { name: "Lunch", content: dietDayMatch?.lunch },
    { name: "Pre / Post Workout", content: dietDayMatch?.snack },
    { name: "Dinner", content: dietDayMatch?.dinner },
    { name: "Before Bed", content: dietDayMatch?.beforeBed },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{isOwner ? "Your active plan" : "Group member plan"}</div>
          <h1>{assignment.memberName}</h1>
          <p>
            {assignment.planName} · {formatPlanWeekday(assignment.startDate)},{" "}
            {formatPlanDate(assignment.startDate)} → {formatPlanDate(endDate)} · {assignment.version}
          </p>
        </div>
        <div className="top-actions">
          <Link className="button ghost" href="/">
            Back to overview
          </Link>
          <span className="avatar large">
            {assignment.memberName
              .split(" ")
              .map((word) => word[0])
              .join("")}
          </span>
        </div>
      </div>

      <div className="notice">
        <span className="notice-icon">!</span>
        <span>
          <strong>Day-based tracking.</strong> Past days without a saved completion are marked Not done. You
          can edit and log any dated day.
        </span>
      </div>

      <div className="section-label">
        <h2>Plan details</h2>
        <span className="tag">{assignment.days.length} dated days loaded</span>
      </div>

      <div className="filter-row">
        <button
          type="button"
          className={`filter ${tab === "workout" ? "active" : ""}`}
          onClick={() => setTab("workout")}
        >
          Workout schedule
        </button>
        <button
          type="button"
          className={`filter ${tab === "diet" ? "active" : ""}`}
          onClick={() => setTab("diet")}
        >
          Diet plan
        </button>
        <button
          type="button"
          className={`filter ${tab === "guidance" ? "active" : ""}`}
          onClick={() => setTab("guidance")}
        >
          Guidance
        </button>
      </div>

      <div style={{ height: 18 }} />

      {tab === "workout" && <WorkoutDay assignment={assignment} initialDay={initialDay} />}

      {tab === "diet" && (
        <div className="diet-container">
          <div className="day-navigation" style={{ marginBottom: 18 }}>
            <div className="day-navigation-heading">
              <div>
                <strong>Diet for Day {selectedDietDay}</strong>
                <span>
                  {formatPlanWeekday(currentDietDate)}, {formatPlanDate(currentDietDate)}
                </span>
              </div>
              <span className="helper-text">Select day to view meals</span>
            </div>
            <div className="week-strip">
              {assignment.days.slice(0, 14).map((d) => {
                const date = addDaysToIso(assignment.startDate, d.planDay - 1);
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`week-day ${d.planDay === selectedDietDay ? "active" : ""}`}
                    onClick={() => setSelectedDietDay(d.planDay)}
                  >
                    <span className="week-day-label">{d.weekday?.slice(0, 3)}</span>
                    <strong>{formatPlanDate(date, false).split(" ")[0]}</strong>
                    <small>Day {d.planDay}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid two">
            <div className="card">
              <div className="card-title-row">
                <div>
                  <h2>Day {selectedDietDay} Meals & Adherence</h2>
                  <p className="card-subtitle">
                    Check off meals as you finish them. Consistency beats perfection.
                  </p>
                </div>
                <span className="tag">
                  {dietLog.completedMeals?.length || 0} / {meals.filter((m) => m.content).length} logged
                </span>
              </div>

              <div className="meal-checklist">
                {meals.map((meal) => {
                  const isChecked = dietLog.completedMeals?.includes(meal.name);
                  return (
                    <div key={meal.name} className={`meal-check-item ${isChecked ? "completed" : ""}`}>
                      <button
                        type="button"
                        className={`check-button ${isChecked ? "checked" : ""}`}
                        onClick={() => toggleMealCheck(meal.name)}
                        aria-label={`Mark ${meal.name} completed`}
                      >
                        {isChecked ? "✓" : ""}
                      </button>
                      <div className="meal-content">
                        <div className="meal-name-row">
                          <strong>{meal.name}</strong>
                          {isChecked && <span className="tag green">Eaten</span>}
                        </div>
                        <p>{meal.content || "No specific items prescribed for this meal."}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="side-stack">
              <div className="card">
                <div className="card-title-row">
                  <div>
                    <h2>Hydration Tracker</h2>
                    <p className="card-subtitle">Target: 2.5–3.5 Liters daily</p>
                  </div>
                  <strong style={{ fontSize: 18 }}>{dietLog.waterLiters || 0} L</strong>
                </div>

                <div className="progress-bar" style={{ height: 10, margin: "14px 0" }}>
                  <span
                    style={{
                      width: `${Math.min(100, (((dietLog.waterLiters || 0) / 3.0) * 100))}%`,
                    }}
                  />
                </div>

                <div className="water-actions" style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="button small" onClick={() => addWater(0.25)}>
                    +250 ml
                  </button>
                  <button type="button" className="button small" onClick={() => addWater(0.5)}>
                    +500 ml
                  </button>
                  <button type="button" className="button small" onClick={() => addWater(1.0)}>
                    +1.0 L
                  </button>
                  <button type="button" className="button ghost small" onClick={() => addWater(-0.5)}>
                    -500 ml
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-title-row">
                  <div>
                    <h2>Daily Nutritional Target</h2>
                    <p className="card-subtitle">From the trainer workbook.</p>
                  </div>
                </div>
                <div className="notice" style={{ marginBottom: 14 }}>
                  <span className="notice-icon">N</span>
                  <span>{dietDayMatch?.target || "2,250–2,350 kcal · 115–125 g protein · 2.5–3.5 L water"}</span>
                </div>
                <div className="metric-list">
                  <div className="metric-row">
                    <span>Protein Target</span>
                    <strong>115–125 g</strong>
                  </div>
                  <div className="metric-row">
                    <span>Target Caloric Range</span>
                    <strong>2,250–2,350 kcal</strong>
                  </div>
                  <div className="metric-row">
                    <span>Trainer Protocol</span>
                    <strong style={{ color: "var(--muted)" }}>Review after 2 weeks</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "guidance" && (
        <div className="grid two">
          {assignment.guidance.map((section) => (
            <div className="card" key={section.title}>
              <div className="card-title-row">
                <div>
                  <h2>{section.title}</h2>
                  <p className="card-subtitle">Keep this alongside your sessions.</p>
                </div>
              </div>
              <div className="metric-list">
                {section.items.map((item) => (
                  <div className="metric-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong style={{ maxWidth: "65%", textAlign: "right", lineHeight: 1.45 }}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="footer-note">
        This plan is a general fitness program. Pain, injury, cardiovascular symptoms, or medical
        restrictions should be reviewed with an appropriate professional.
      </div>
    </>
  );
}
