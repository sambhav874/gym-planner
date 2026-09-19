import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "../lib/workbook-parser";

async function fixture(name: string): Promise<ArrayBuffer> {
  const file = await readFile(resolve(process.cwd(), "data", name));
  const copy = new Uint8Array(file.byteLength);
  copy.set(file);
  return copy.buffer;
}

describe("workbook parser", () => {
  it("normalizes the daily sample workbook", async () => {
    const plan = await parseWorkbook(await fixture("23 M Short client workout plan.xlsx"), "daily.xlsx");
    expect(plan.sourceFormat).toBe("daily");
    expect(plan.days).toHaveLength(30);
    expect(plan.days[0].focus).toBe("Push A");
    expect(plan.days[0].exercises[0].exercise).toMatch(/bench/i);
    expect(plan.dietDays).toHaveLength(0);
    expect(plan.guidance.length).toBeGreaterThan(0);
    expect(plan.guidance.some((section) => section.title === "Meal options")).toBe(true);
  });

  it("normalizes the exercise-level sample workbook and retains rules", async () => {
    const plan = await parseWorkbook(await fixture("Sambhav Workout and Diet Plan.xlsx"), "exercise-level.xlsx");
    expect(plan.sourceFormat).toBe("exercise-level");
    expect(plan.days.reduce((count, day) => count + day.exercises.length, 0)).toBe(209);
    expect(plan.dietDays).toHaveLength(30);
    expect(plan.days[0].planDay).toBe(1);
    expect(plan.days.at(-1)?.planDay).toBe(30);
    expect(plan.guidance.some((section) => section.title === "Training rules")).toBe(true);
  });

  it("flags an unsupported workbook instead of silently creating an empty plan", async () => {
    const invalid = new Uint8Array([104, 101, 108, 108, 111]);
    const plan = await parseWorkbook(invalid.buffer, "invalid.xlsx");
    expect(plan.days).toHaveLength(0);
    expect(plan.warnings.some((warning) => warning.severity === "error")).toBe(true);
  });

  it("parses a daily CSV export", async () => {
    const csv = [
      "Day,Training Focus,Weight Training,Sets x Reps,Cardio,Daily Movement,Coach Notes",
      "1,Push A,Barbell bench press;Cable fly,3x6-10;2x12-15,Incline treadmill 15 min,7000 steps,Controlled reps",
    ].join("\n");
    const plan = await parseWorkbook(new TextEncoder().encode(csv), "sambhav.csv");
    expect(plan.sourceFormat).toBe("daily");
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].exercises).toHaveLength(2);
    expect(plan.days[0].exercises[1].sets).toBe("2");
    expect(plan.days[0].cardio).toBe("Incline treadmill 15 min");
  });
});
