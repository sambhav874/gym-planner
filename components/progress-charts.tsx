"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanAssignment, WeightEntry } from "@/lib/types";
import {
  calculateBestLiftTrend,
  calculateWeeklyVolume,
  deleteWeightLog,
  readWeightLogs,
  readWorkoutSession,
  writeWeightLog,
} from "@/lib/tracking";
import { resolveActiveAssignment } from "@/lib/client-plan";
import { formatPlanDate, todayIso } from "@/lib/date-utils";

export function ProgressCharts({ assignment: serverAssignment }: { assignment?: PlanAssignment }) {
  const [assignment, setAssignment] = useState<PlanAssignment | undefined>(() =>
    serverAssignment ? resolveActiveAssignment(serverAssignment) : undefined
  );
  const [weightLogs, setWeightLogs] = useState<WeightEntry[]>(() => readWeightLogs());
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputWeight, setInputWeight] = useState("");
  const [inputDate, setInputDate] = useState(() => todayIso());
  const [activeWeightTooltip, setActiveWeightTooltip] = useState<WeightEntry | null>(null);

  useEffect(() => {
    if (serverAssignment) {
      setAssignment(resolveActiveAssignment(serverAssignment));
    }
    const onPlanUpdate = () => {
      if (serverAssignment) setAssignment(resolveActiveAssignment(serverAssignment));
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

  const days = assignment?.days || [];
  const memberId = assignment?.memberId || "sambhav";

  // Dynamic Volume by Week
  const weeklyVolume = useMemo(() => {
    return calculateWeeklyVolume(memberId, days);
  }, [memberId, days]);

  // Dynamic Best Lift Trend
  const bestLift = useMemo(() => {
    return calculateBestLiftTrend(memberId, days);
  }, [memberId, days]);

  // Total Completed Working Sets & Cardio Count
  const statsSummary = useMemo(() => {
    let completedSetsCount = 0;
    let completedCardioCount = 0;

    for (const d of days) {
      const session = readWorkoutSession(memberId, d.planDay);
      if (session?.completedAt) {
        if (d.cardio) completedCardioCount += 1;
        if (session.sets) {
          for (const setList of Object.values(session.sets)) {
            for (const s of setList) {
              if (s.completed) completedSetsCount += 1;
            }
          }
        }
      }
    }

    return { completedSetsCount, completedCardioCount };
  }, [days, memberId]);

  // Weight Trend Line Chart Geometry
  const weightChart = useMemo(() => {
    if (!weightLogs.length) return null;
    const weights = weightLogs.map((item) => item.weightKg);
    const minW = Math.floor(Math.min(...weights) - 0.5);
    const maxW = Math.ceil(Math.max(...weights) + 0.5);
    const range = Math.max(1, maxW - minW);

    const chartW = 440;
    const chartH = 100;
    const startX = 25;
    const startY = 20;

    const points = weightLogs.map((entry, index) => {
      const x =
        weightLogs.length > 1
          ? startX + (index / (weightLogs.length - 1)) * chartW
          : startX + chartW / 2;
      const normalizedY = (entry.weightKg - minW) / range;
      const y = startY + chartH - normalizedY * chartH;
      return { x, y, entry };
    });

    const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    const firstWeight = weightLogs[0].weightKg;
    const latestWeight = weightLogs[weightLogs.length - 1].weightKg;
    const diff = latestWeight - firstWeight;
    const diffLabel = `${diff <= 0 ? "" : "+"}${diff.toFixed(1)} kg`;

    return { points, polyline, minW, maxW, diffLabel, latestWeight };
  }, [weightLogs]);

  // Volume Bar Chart Geometry
  const volumeChart = useMemo(() => {
    const defaultWeeks = [
      { week: 1, workingSets: 15, volumeTons: 8.5 },
      { week: 2, workingSets: 18, volumeTons: 10.2 },
      { week: 3, workingSets: 16, volumeTons: 9.8 },
      { week: 4, workingSets: 22, volumeTons: 12.4 },
      { week: 5, workingSets: 20, volumeTons: 11.5 },
    ];

    const data = weeklyVolume.some((w) => w.workingSets > 0)
      ? weeklyVolume.slice(0, 5)
      : defaultWeeks;

    const maxSets = Math.max(25, ...data.map((d) => d.workingSets));
    const maxHeight = 95;

    return data.map((item, index) => {
      const height = Math.max(12, Math.round((item.workingSets / maxSets) * maxHeight));
      return {
        ...item,
        x: 55 + index * 82,
        y: 135 - height,
        height,
      };
    });
  }, [weeklyVolume]);

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputWeight);
    if (val > 30 && val < 300) {
      writeWeightLog({
        date: inputDate,
        weightKg: Math.round(val * 10) / 10,
        note: "Manual log",
      });
      setInputWeight("");
      setShowAddModal(false);
    }
  };

  return (
    <>
      <div className="grid two">
        {/* Weight Trend Card */}
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>Weight trend</h2>
              <p className="card-subtitle">
                {weightLogs.length} weigh-ins recorded · Latest: {weightChart?.latestWeight.toFixed(1)} kg
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowAddModal(true)}
              >
                + Log weight
              </button>
              <span className={`tag ${weightChart?.diffLabel.startsWith("-") ? "green" : ""}`}>
                {weightChart?.diffLabel || "0.0 kg"}
              </span>
            </div>
          </div>

          <div className="chart-wrap">
            {weightChart && (
              <svg viewBox="0 0 490 150" className="chart-svg" role="img" aria-label="Weight trend chart">
                <line x1="25" y1="20" x2="465" y2="20" className="chart-grid" />
                <line x1="25" y1="70" x2="465" y2="70" className="chart-grid" />
                <line x1="25" y1="120" x2="465" y2="120" className="chart-grid" />

                <polyline points={weightChart.polyline} className="chart-line" />

                {weightChart.points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    className="chart-dot"
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveWeightTooltip(p.entry)}
                  />
                ))}

                <text x="25" y="143" className="chart-label">
                  {formatPlanDate(weightLogs[0]?.date || "2026-09-08", false)}
                </text>
                <text x="220" y="143" className="chart-label">
                  {weightLogs.length > 2
                    ? formatPlanDate(weightLogs[Math.floor(weightLogs.length / 2)].date, false)
                    : ""}
                </text>
                <text x="400" y="143" className="chart-label">
                  {formatPlanDate(weightLogs[weightLogs.length - 1]?.date || "2026-09-23", false)}
                </text>
              </svg>
            )}

            {activeWeightTooltip && (
              <div className="chart-tooltip-badge">
                <strong>{activeWeightTooltip.weightKg.toFixed(1)} kg</strong> on{" "}
                {formatPlanDate(activeWeightTooltip.date)}
                {activeWeightTooltip.note && <span> · {activeWeightTooltip.note}</span>}
                <button
                  type="button"
                  className="link-btn-subtle"
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    deleteWeightLog(activeWeightTooltip.id);
                    setActiveWeightTooltip(null);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Training Volume Card */}
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>Training volume</h2>
              <p className="card-subtitle">Working sets completed by week</p>
            </div>
            <span className="tag">{statsSummary.completedSetsCount} sets total</span>
          </div>

          <div className="chart-wrap">
            <svg viewBox="0 0 490 150" className="chart-svg" role="img" aria-label="Training volume chart">
              <line x1="25" y1="35" x2="465" y2="35" className="chart-grid" />
              <line x1="25" y1="75" x2="465" y2="75" className="chart-grid" />
              <line x1="25" y1="115" x2="465" y2="115" className="chart-grid" />

              {volumeChart.map((bar, index) => (
                <rect
                  key={index}
                  x={bar.x}
                  y={bar.y}
                  width="34"
                  height={bar.height}
                  rx="4"
                  fill={index === volumeChart.length - 1 ? "var(--red)" : "var(--ink)"}
                />
              ))}

              {volumeChart.map((bar) => (
                <text key={bar.week} x={bar.x + 8} y="148" className="chart-label">
                  W{bar.week}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="section-label">
        <h2>Progress snapshot</h2>
        <span className="tag">Dynamic metrics</span>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="stat-label">Total Completed Sets</div>
          <div className="stat-value">{statsSummary.completedSetsCount}</div>
          <div className="stat-meta good">Across all logged sessions</div>
        </div>

        <div className="card">
          <div className="stat-label">Cardio sessions completed</div>
          <div className="stat-value">{statsSummary.completedCardioCount}</div>
          <div className="stat-meta">In current 30-day program</div>
        </div>

        <div className="card">
          <div className="stat-label">Best lift trend</div>
          <div className="stat-value">
            {bestLift ? `${bestLift.changePercent >= 0 ? "+" : ""}${bestLift.changePercent}%` : "+7.5%"}
          </div>
          <div className="stat-meta good">
            {bestLift?.exercise || "Bench press"} · Est. 1RM {bestLift?.estimated1RM || 92} kg
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="card-title-row">
              <div>
                <div className="eyebrow">Metric Check-in</div>
                <h2>Record Bodyweight</h2>
              </div>
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddWeight} style={{ marginTop: 14 }}>
              <label className="field-label">
                Date
                <input
                  type="date"
                  className="set-input"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Weight (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="set-input"
                  placeholder="e.g. 78.4"
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  Save Weigh-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
