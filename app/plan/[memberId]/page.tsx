import { AppShell } from "@/components/app-shell";
import { PlanView } from "@/components/plan-view";
import { getAssignment } from "@/lib/store";

export default async function PlanPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const assignment = await getAssignment(memberId);
  return <AppShell active={memberId === "sambhav" ? "/plan/sambhav" : ""}><PlanView assignment={assignment} isOwner={memberId === "sambhav"} /></AppShell>;
}
