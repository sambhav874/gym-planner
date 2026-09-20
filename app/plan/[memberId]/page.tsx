import { AppShell } from "@/components/app-shell";
import { PlanView } from "@/components/plan-view";
import { getAssignment } from "@/lib/store";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams?: Promise<{ day?: string }> }) {
  const { memberId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const initialDay = query?.day ? Number(query.day) : undefined;
  const assignment = await getAssignment(memberId);
  return <AppShell active={memberId === "sambhav" ? "/plan/sambhav" : ""}><PlanView assignment={assignment} isOwner={memberId === "sambhav"} initialDay={Number.isFinite(initialDay) ? initialDay : undefined} /></AppShell>;
}
