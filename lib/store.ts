import fs from "node:fs/promises";
import path from "node:path";
import { demoAssignment, members as fallbackMembers } from "./demo-data";
import { parseWorkbook } from "./workbook-parser";
import type { Member, PlanAssignment } from "./types";

const PLAN_START_DATE = "2026-09-14";
const seededSources = [
  {
    memberId: "sambhav",
    memberName: "Sambhav Jain",
    fileName: "Sambhav Workout and Diet Plan.xlsx",
    planName: "30-day workout and diet plan",
    focus: "Fat loss + muscle retention",
    progress: 72,
    lastSeen: "Logged today",
    weight: "78 kg",
  },
  {
    memberId: "shivam",
    memberName: "Shivam",
    fileName: "23 M Short client workout plan.xlsx",
    planName: "30-day fat loss + muscle plan",
    focus: "Fat loss + muscle gain/retention",
    progress: 0,
    lastSeen: "Not logged yet",
    weight: "78 kg",
  },
] as const;

type SeededData = { members: Member[]; assignments: Record<string, PlanAssignment> };

let seededDataPromise: Promise<SeededData> | undefined;

async function loadSeededData(): Promise<SeededData> {
  const assignments: Record<string, PlanAssignment> = {};
  const members: Member[] = [];

  for (const source of seededSources) {
    try {
      const filePath = path.join(process.cwd(), "data", source.fileName);
      const plan = await parseWorkbook(await fs.readFile(filePath), source.fileName);
      assignments[source.memberId] = {
        memberId: source.memberId,
        memberName: source.memberName,
        planName: source.planName,
        startDate: PLAN_START_DATE,
        version: "v1.0",
        days: plan.days,
        dietDays: plan.dietDays,
        guidance: [...plan.guidance, ...(plan.overview.length ? [{ title: "Plan overview", items: plan.overview }] : [])],
      };
      members.push({
        id: source.memberId,
        name: source.memberName,
        initials: source.memberName.split(" ").map((word) => word[0]).join("").slice(0, 2),
        focus: source.focus,
        progress: source.progress,
        lastSeen: source.lastSeen,
        weight: source.weight,
      });
    } catch {
      // Vercel includes the source workbooks through next.config.mjs. Keep a safe
      // fallback so the rest of the app remains renderable if a file is missing.
      const fallback = source.memberId === demoAssignment.memberId
        ? demoAssignment
        : { ...demoAssignment, memberId: source.memberId, memberName: source.memberName, planName: source.planName, startDate: PLAN_START_DATE };
      assignments[source.memberId] = fallback;
      members.push(fallbackMembers.find((member) => member.id === source.memberId) || {
        id: source.memberId,
        name: source.memberName,
        initials: source.memberName.slice(0, 2).toUpperCase(),
        focus: source.focus,
        progress: source.progress,
        lastSeen: source.lastSeen,
        weight: source.weight,
      });
    }
  }

  return { members, assignments };
}

function seededData(): Promise<SeededData> {
  seededDataPromise ??= loadSeededData();
  return seededDataPromise;
}

export async function getMembers(): Promise<Member[]> {
  return (await seededData()).members;
}

export async function getAssignment(memberId: string): Promise<PlanAssignment> {
  const data = await seededData();
  if (data.assignments[memberId]) return data.assignments[memberId];
  return { ...demoAssignment, memberId, memberName: data.members.find((member) => member.id === memberId)?.name || "Group member" };
}
