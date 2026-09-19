import ExcelJS from "exceljs";
import type {
  DietDay,
  ExercisePrescription,
  GuidanceSection,
  ImportWarning,
  ParsedPlan,
  ScheduleDay,
} from "./types";

type Cell = string | number | boolean | Date | null | undefined;
type Row = Cell[];

const clean = (value: Cell) => String(value ?? "").trim();
const lower = (value: Cell) => clean(value).toLowerCase();
const dash = (value: string) => value.replace(/[–—−]/g, "-").replace(/×/g, "x");
const sheetKey = (value: string) => lower(value).replace(/[^a-z0-9]/g, "");

function cellValue(value: ExcelJS.CellValue | null | undefined): Cell {
  if (value === null || value === undefined || typeof value !== "object" || value instanceof Date) return value as Cell;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return cellValue(value.result);
  if ("text" in value) return value.text;
  return String(value);
}

function rowsFor(workbook: ExcelJS.Workbook, name: string): Row[] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return [];
  const rows: Row[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: Row = [];
    for (let column = 1; column <= sheet.columnCount; column += 1) values.push(cellValue(row.getCell(column).value));
    rows.push(values);
  });
  return rows;
}

function parseCsvRows(text: string): Row[] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: Row[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function parseCsv(buffer: ArrayBuffer | Uint8Array, sourceFileName: string): ParsedPlan {
  const rows = parseCsvRows(Buffer.from(buffer as any).toString("utf8"));
  const warnings: ImportWarning[] = [];
  if (!rows.length) {
    return {
      sourceFileName,
      sourceFormat: "unknown",
      overview: [],
      days: [],
      dietDays: [],
      guidance: [],
      warnings: [{ severity: "error", sheet: "csv", message: "The CSV file is empty." }],
      stats: { dayCount: 0, exerciseCount: 0, dietDayCount: 0, warningCount: 1 },
    };
  }
  const index = headerIndex(rows[0]);
  const sheetName = sourceFileName;
  let days: ScheduleDay[] = [];
  let dietDays: DietDay[] = [];
  let guidance: GuidanceSection[] = [];
  let sourceFormat: ParsedPlan["sourceFormat"] = "unknown";
  if (index.trainingfocus !== undefined || index.weighttraining !== undefined) {
    sourceFormat = "daily";
    days = parseDailyRows(rows, sheetName, warnings);
  } else if (index.exercise !== undefined && index.week !== undefined) {
    sourceFormat = "exercise-level";
    const parsed = parseExerciseRows(rows, sheetName, warnings);
    days = parsed.days;
    if (parsed.rules.length) guidance.push({ title: "Training rules", items: parsed.rules });
  } else if (index.breakfast !== undefined || index.dailytarget !== undefined) {
    const diet = parseDietRows(rows);
    dietDays = diet.days;
    guidance = diet.guidance;
  } else {
    warnings.push({ severity: "error", sheet: sheetName, message: "CSV headers did not match a supported workout or diet format." });
  }
  const exerciseCount = days.reduce((count, day) => count + day.exercises.length, 0);
  return {
    sourceFileName,
    sourceFormat,
    overview: [],
    days,
    dietDays,
    guidance,
    warnings,
    stats: { dayCount: days.length, exerciseCount, dietDayCount: dietDays.length, warningCount: warnings.length },
  };
}

function findSheet(workbook: ExcelJS.Workbook, candidates: string[]): string | undefined {
  const wanted = candidates.map(sheetKey);
  return workbook.worksheets.find((sheet) => wanted.includes(sheetKey(sheet.name)))?.name;
}

function headerIndex(row: Row): Record<string, number> {
  return Object.fromEntries(row.map((cell, index) => [sheetKey(clean(cell)), index]));
}

function numeric(value: Cell): number | undefined {
  if (value === null || value === undefined || clean(value) === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dayNumber(value: Cell): number | undefined {
  const direct = numeric(value);
  if (direct !== undefined) return direct;
  const match = clean(value).match(/day\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function weekdayFromDay(day: number): string {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(day - 1) % 7];
}

function weekdayIndex(value: string): number | undefined {
  const names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const found = names.indexOf(value.toLowerCase());
  return found === -1 ? undefined : found;
}

function splitItems(value: Cell): string[] {
  return clean(value)
    .split(/[;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrescription(value: string, fallback?: string): { sets?: string; reps?: string; duration?: string } {
  const normalized = dash(value);
  const match = normalized.match(/^\s*([\d–-]+(?:\s*[–-]\s*[\d]+)?)\s*x\s*(.+?)\s*$/i);
  if (match) return { sets: match[1], reps: match[2] };
  if (/\b(min|sec|steps|walk|cardio)\b/i.test(normalized)) return { duration: normalized };
  return { reps: fallback || normalized || undefined };
}

function parseDailyRows(rows: Row[], sheetName: string, warnings: ImportWarning[]): ScheduleDay[] {
  if (!rows.length) return [];
  const index = headerIndex(rows[0]);
  const days: ScheduleDay[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const day = dayNumber(row[index.day]);
    if (day === undefined) {
      if (row.some((cell) => clean(cell))) warnings.push({ severity: "warning", sheet: sheetName, row: i + 1, message: "Skipped a row without a numeric plan day." });
      continue;
    }
    const names = splitItems(row[index.weighttraining]);
    const prescriptions = splitItems(row[index.setsxreps]);
    const exercises: ExercisePrescription[] = names.map((name, exerciseIndex) => {
      const parsed = parsePrescription(prescriptions[exerciseIndex] || prescriptions[0] || "");
      return {
        id: `day-${day}-exercise-${exerciseIndex + 1}`,
        exercise: name,
        sets: parsed.sets,
        reps: parsed.reps,
        duration: parsed.duration,
      };
    });
    if (!exercises.length && clean(row[index.weighttraining])) {
      warnings.push({ severity: "warning", sheet: sheetName, row: i + 1, message: "A training row has content but no parsed exercise." });
    }
    const focus = clean(row[index.trainingfocus]) || "Training day";
    days.push({
      id: `day-${day}`,
      planDay: day,
      week: Math.ceil(day / 7),
      weekday: weekdayFromDay(day),
      focus,
      exercises,
      cardio: clean(row[index.cardio]) || undefined,
      dailyMovement: clean(row[index.dailymovement]) || undefined,
      coachNotes: [clean(row[index.coachnotes]), clean(row[index.undefined])].filter(Boolean).join(" ") || undefined,
      isRecovery: /recovery|rest|assessment/i.test(focus),
    });
  }
  return days;
}

function parseExerciseRows(rows: Row[], sheetName: string, warnings: ImportWarning[]): { days: ScheduleDay[]; rules: Array<{ label: string; value: string }> } {
  if (!rows.length) return { days: [], rules: [] };
  const index = headerIndex(rows[0]);
  const grouped = new Map<string, ScheduleDay>();
  const rules: Array<{ label: string; value: string }> = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const week = numeric(row[index.week]);
    if (week === undefined) {
      const label = clean(row[index.day]);
      const value = clean(row[index.week]);
      if (label && label !== "Day") rules.push({ label, value });
      continue;
    }
    const sourceDay = clean(row[index.day]);
    const weekday = sourceDay.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i)?.[0];
    const weekdayPosition = weekday ? weekdayIndex(weekday) : undefined;
    const planDay = sourceDay.match(/day\s*(\d+)/i)?.[1]
      ? Number(sourceDay.match(/day\s*(\d+)/i)?.[1])
      : weekdayPosition === undefined ? (week - 1) * 7 + 1 : (week - 1) * 7 + weekdayPosition + 1;
    const key = `${week}-${planDay}`;
    const existing = grouped.get(key);
    const exercise = clean(row[index.exercise]);
    if (!exercise) {
      warnings.push({ severity: "warning", sheet: sheetName, row: i + 1, message: "Skipped an exercise row without an exercise name." });
      continue;
    }
    const prescription: ExercisePrescription = {
      id: `week-${week}-day-${planDay}-exercise-${(existing?.exercises.length || 0) + 1}`,
      muscleGroup: clean(row[index.musclegroup]) || undefined,
      exercise,
      sets: clean(row[index.sets]) || undefined,
      reps: dash(clean(row[index.repsduration])) || undefined,
      rir: clean(row[index.rirnotes]).match(/\d[^.]*RIR/i)?.[0],
      notes: clean(row[index.rirnotes]) || undefined,
    };
    const day = existing || {
      id: `week-${week}-day-${planDay}`,
      planDay,
      week,
      weekday: weekday || weekdayFromDay(planDay),
      focus: clean(row[index.musclegroup]) || "Workout",
      exercises: [],
    };
    day.exercises.push(prescription);
    if (!existing) grouped.set(key, day);
  }
  const days = [...grouped.values()].sort((a, b) => a.planDay - b.planDay);
  days.forEach((day) => {
    const groups = [...new Set(day.exercises.map((exercise) => exercise.muscleGroup).filter(Boolean))];
    day.focus = groups.length > 1 ? groups.slice(0, 2).join(" + ") : groups[0] || day.focus;
    day.isRecovery = /recovery|rest/i.test(day.focus) || day.exercises.some((exercise) => /complete rest|active recovery/i.test(exercise.exercise));
  });
  return { days, rules };
}

function parseDietRows(rows: Row[]): { days: DietDay[]; guidance: GuidanceSection[] } {
  if (!rows.length) return { days: [], guidance: [] };
  const index = headerIndex(rows[0]);
  const days: DietDay[] = [];
  const portions: Array<{ label: string; value: string }> = [];
  const adjustments: Array<{ label: string; value: string }> = [];
  const mealOptions: Array<{ label: string; value: string }> = [];
  let currentSection: "portions" | "adjustments" | undefined;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const day = numeric(row[index.day]);
    const week = numeric(row[index.week]);
    if (day !== undefined && week !== undefined) {
      days.push({
        day,
        week,
        breakfast: clean(row[index.breakfast]) || clean(row[index.option1]) || undefined,
        lunch: clean(row[index.lunch]) || undefined,
        snack: clean(row[index.prepostworkoutsnack]) || clean(row[index.option2]) || undefined,
        dinner: clean(row[index.dinner]) || clean(row[index.option3]) || undefined,
        beforeBed: clean(row[index.beforebed]) || undefined,
        target: clean(row[index.dailytarget]) || clean(row[index.targetnotes]) || undefined,
      });
      continue;
    }
    const label = clean(row[0]);
    if (!label) continue;
    if (index.meal !== undefined && index.option1 !== undefined) {
      const options = [row[index.option1], row[index.option2], row[index.option3], row[index.targetnotes]].map(clean).filter(Boolean);
      if (options.length) mealOptions.push({ label, value: options.join(" · ") });
    }
    if (/key portions|protein guide/i.test(label)) { currentSection = "portions"; continue; }
    if (/adjustment rule/i.test(label)) { currentSection = "adjustments"; continue; }
    const value = clean(row[1]) || clean(row[2]);
    if (value && currentSection === "portions") portions.push({ label, value });
    if (value && currentSection === "adjustments") adjustments.push({ label, value });
  }
  const guidance: GuidanceSection[] = [];
  if (mealOptions.length) guidance.push({ title: "Meal options", items: mealOptions });
  if (portions.length) guidance.push({ title: "Portion guide", items: portions });
  if (adjustments.length) guidance.push({ title: "Adjustment rules", items: adjustments });
  return { days, guidance };
}

function parseKeyValue(rows: Row[]): Array<{ label: string; value: string }> {
  return rows.filter((row) => clean(row[0]) && clean(row[1])).map((row) => ({ label: clean(row[0]), value: clean(row[1]) }));
}

function parseGuidance(workbook: ExcelJS.Workbook): GuidanceSection[] {
  const sections: GuidanceSection[] = [];
  const simpleSheets = [
    ["Cardio Guide", "Cardio guide"],
    ["Strength Progression", "Strength progression"],
    ["Coach Rules", "Coach rules"],
    ["Progress Tracker", "Progress tracker"],
  ] as const;
  for (const [candidate, title] of simpleSheets) {
    const name = findSheet(workbook, [candidate]);
    if (!name) continue;
    const rows = rowsFor(workbook, name);
    if (!rows.length) continue;
    const headers = rows[0].map(clean);
    const items = rows.slice(1).filter((row) => row.some((cell) => clean(cell))).map((row) => ({ label: clean(row[0]), value: row.slice(1).map(clean).filter(Boolean).join(" · ") }));
    sections.push({ title, items: [{ label: headers.join(" / "), value: "" }, ...items] });
  }
  return sections;
}

export async function parseWorkbook(buffer: ArrayBuffer | Uint8Array, sourceFileName = "uploaded-workbook.xlsx"): Promise<ParsedPlan> {
  if (/\.csv$/i.test(sourceFileName)) return parseCsv(buffer, sourceFileName);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(buffer as any) as any);
  } catch {
    return {
      sourceFileName,
      sourceFormat: "unknown",
      overview: [],
      days: [],
      dietDays: [],
      guidance: [],
      warnings: [{ severity: "error", sheet: "workbook", message: "The file could not be read as a supported workbook." }],
      stats: { dayCount: 0, exerciseCount: 0, dietDayCount: 0, warningCount: 1 },
    };
  }
  const warnings: ImportWarning[] = [];
  const overviewSheet = findSheet(workbook, ["Plan Overview"]);
  const workoutDailySheet = findSheet(workbook, ["30-Day Training"]);
  const workoutExerciseSheet = findSheet(workbook, ["Workout Plan"]);
  const dietSheet = findSheet(workbook, ["Diet Plan"]);
  const overview = overviewSheet ? parseKeyValue(rowsFor(workbook, overviewSheet)) : [];
  let days: ScheduleDay[] = [];
  let sourceFormat: ParsedPlan["sourceFormat"] = "unknown";
  let guidance = parseGuidance(workbook);

  if (workoutDailySheet) {
    sourceFormat = "daily";
    days = parseDailyRows(rowsFor(workbook, workoutDailySheet), workoutDailySheet, warnings);
  } else if (workoutExerciseSheet) {
    sourceFormat = "exercise-level";
    const parsed = parseExerciseRows(rowsFor(workbook, workoutExerciseSheet), workoutExerciseSheet, warnings);
    days = parsed.days;
    if (parsed.rules.length) guidance = [...guidance, { title: "Training rules", items: parsed.rules }];
  } else {
    warnings.push({ severity: "error", sheet: "workbook", message: "No supported workout sheet was found." });
  }

  let dietDays: DietDay[] = [];
  if (dietSheet) {
    const diet = parseDietRows(rowsFor(workbook, dietSheet));
    dietDays = diet.days;
    guidance = [...guidance, ...diet.guidance];
  } else {
    warnings.push({ severity: "warning", sheet: "workbook", message: "No diet sheet was found. The plan can still be published without diet content." });
  }

  const exerciseCount = days.reduce((count, day) => count + day.exercises.length, 0);
  return {
    sourceFileName,
    sourceFormat,
    overview,
    days,
    dietDays,
    guidance,
    warnings,
    stats: { dayCount: days.length, exerciseCount, dietDayCount: dietDays.length, warningCount: warnings.length },
  };
}
