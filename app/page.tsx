import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getAssignment, getMembers } from "@/lib/store";

export default async function HomePage() {
  const [members, assignment] = await Promise.all([getMembers(), getAssignment("sambhav")]);
  return <AppShell active="/"><Dashboard members={members} assignment={assignment} /></AppShell>;
}
