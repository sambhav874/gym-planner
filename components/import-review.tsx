"use client";

import { useState } from "react";
import { members } from "@/lib/demo-data";
import type { ParsedPlan } from "@/lib/types";

export function ImportReview() {
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memberId, setMemberId] = useState("sambhav");
  const [startDate, setStartDate] = useState("2026-09-14");
  const [savedAs, setSavedAs] = useState<"draft" | "published" | "">("");

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setSavedAs("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/imports", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to parse workbook.");
      setPlan(payload.plan as ParsedPlan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to parse workbook.");
    } finally {
      setLoading(false);
    }
  };

  const savePlan = (status: "draft" | "published") => {
    if (!plan) return;
    const member = members.find((item) => item.id === memberId) || members[0];
    window.localStorage.setItem(`formwork-${status}`, JSON.stringify({
      memberId: member.id,
      memberName: member.name,
      startDate,
      version: status === "published" ? "v1.0" : "draft",
      plan,
      savedAt: new Date().toISOString(),
    }));
    setSavedAs(status);
  };

  return <div className="import-shell">
    <div className="topbar">
      <div>
        <div className="eyebrow">Trainer workspace</div>
        <h1>Import a training plan.</h1>
        <p>Upload an Excel workbook or CSV, review the normalized plan, then assign a start date before publishing.</p>
      </div>
      <div className="top-actions"><span className="avatar large">SJ</span></div>
    </div>

    {!plan && <div className="card">
      <label className="dropzone">
        <input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <div>
          <div className="drop-icon">UPLOAD</div>
          <h2>Drop a workbook or CSV here</h2>
          <p>Supports the supplied daily and exercise-level formats. The original file stays untouched.</p>
          {file && <div className="file-name">{file.name}</div>}
          <span className="button primary" role="button">Choose workbook</span>
        </div>
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="button primary" onClick={upload} disabled={!file || loading}>{loading ? "Reading workbook…" : "Review import"}</button>
      </div>
      {error && <div className="warning" style={{ marginTop: 14 }}>{error}</div>}
      <p className="footer-note">Parsing runs on the server. On Vercel, uploads should be connected to protected storage before using this with real member data.</p>
    </div>}

    {plan && <div className="review-grid">
      <div className="review-sidebar">
        <div className="card">
          <div className="eyebrow">Detected workbook</div>
          <h3 style={{ marginTop: 8, lineHeight: 1.35 }}>{plan.sourceFileName}</h3>
          <div style={{ marginTop: 15 }}>
            {[["Format", plan.sourceFormat === "daily" ? "One row per day" : "Exercise-level"], ["Workout days", plan.stats.dayCount], ["Exercises", plan.stats.exerciseCount], ["Diet days", plan.stats.dietDayCount], ["Warnings", plan.stats.warningCount]].map(([label, value]) => <div className="review-stat" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Assignment</div>
          <div className="assignment-fields">
            <label className="field-label">Member<select className="set-input" value={memberId} onChange={(event) => setMemberId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="field-label">Start date<input className="set-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          </div>
          <div className="assignment-actions">
            <button className="button" onClick={() => savePlan("draft")}>Save draft</button>
            <button className="button primary" onClick={() => savePlan("published")}>Publish plan</button>
          </div>
          {savedAs && <div className="notice" style={{ marginTop: 12 }}><span className="notice-icon">✓</span><span><strong>{savedAs === "published" ? "Plan published." : "Draft saved."}</strong> Stored in this browser for the demo.</span></div>}
        </div>
        {plan.warnings.map((warning, index) => <div className="warning" key={`${warning.sheet}-${warning.row}-${index}`}>{warning.sheet}{warning.row ? ` · row ${warning.row}` : ""}: {warning.message}</div>)}
        <button className="button ghost" onClick={() => { setPlan(null); setFile(null); setSavedAs(""); }}>Import another file</button>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div><div className="eyebrow">Normalized preview</div><h2>Review daily schedule</h2><p className="card-subtitle">Confirm the parser kept the meaning of the original workbook.</p></div>
          <span className="tag">Ready to assign</span>
        </div>
        <div className="review-table-wrap">
          <table className="review-table"><thead><tr><th>Day</th><th>Focus</th><th>Exercises</th><th>Cardio / movement</th><th>Coach notes</th></tr></thead>
            <tbody>{plan.days.slice(0, 12).map((day) => <tr key={day.id}><td>D{day.planDay}<small>W{day.week} · {day.weekday}</small></td><td><strong>{day.focus}</strong></td><td>{day.exercises.slice(0, 4).map((exercise) => <div key={exercise.id} style={{ marginBottom: 7 }}><strong>{exercise.exercise}</strong><small>{exercise.sets ? `${exercise.sets} sets · ${exercise.reps || exercise.duration || "as prescribed"}` : exercise.reps || exercise.duration}</small></div>)}{day.exercises.length > 4 && <small>+ {day.exercises.length - 4} more</small>}</td><td>{day.cardio || "—"}<small>{day.dailyMovement || ""}</small></td><td>{day.coachNotes || "—"}</td></tr>)}</tbody>
          </table>
        </div>
        {plan.days.length > 12 && <p className="footer-note">Showing the first 12 days of {plan.days.length}. The full normalized schedule will be stored in the draft.</p>}
        <div className="section-label" style={{ marginTop: 24 }}><h2>Guidance found</h2><span className="tag">{plan.guidance.length} sections</span></div>
        <div className="grid three">{plan.guidance.slice(0, 3).map((section) => <div className="card flat" key={section.title}><h3>{section.title}</h3><p className="card-subtitle">{section.items.length} items retained</p></div>)}</div>
      </div>
    </div>}
  </div>;
}
