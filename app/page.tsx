import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";

export default async function HomePage() {
  return <AppShell active="/"><Dashboard /></AppShell>;
}
