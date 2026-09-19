import { AppShell } from "@/components/app-shell";
import { ProgressCharts } from "@/components/progress-charts";

export default function ProgressPage() {
  return <AppShell active="/progress"><div className="topbar"><div><div className="eyebrow">Your progress</div><h1>Proof of the work.</h1><p>Use trends to make the next adjustment deliberate.</p></div><div className="top-actions"><span className="avatar large">SJ</span></div></div><ProgressCharts /></AppShell>;
}
