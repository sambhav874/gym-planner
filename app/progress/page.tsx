import { AppShell } from "@/components/app-shell";
import { ProgressCharts } from "@/components/progress-charts";
import { getAssignment } from "@/lib/store";

export default async function ProgressPage() {
  const assignment = await getAssignment("sambhav");

  return (
    <AppShell active="/progress">
      <div className="topbar">
        <div>
          <div className="eyebrow">Your progress</div>
          <h1>Proof of the work.</h1>
          <p>Use trends to make the next adjustment deliberate.</p>
        </div>
        <div className="top-actions">
          <span className="avatar large">SJ</span>
        </div>
      </div>
      <ProgressCharts assignment={assignment} />
    </AppShell>
  );
}
