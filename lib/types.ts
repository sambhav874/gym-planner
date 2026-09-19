export type PlanStatus = "draft" | "published" | "archived";

export interface ImportWarning {
  severity: "warning" | "error";
  sheet: string;
  row?: number;
  message: string;
}

export interface ExercisePrescription {
  id: string;
  muscleGroup?: string;
  exercise: string;
  sets?: string;
  reps?: string;
  duration?: string;
  rir?: string;
  notes?: string;
}

export interface ScheduleDay {
  id: string;
  planDay: number;
  week: number;
  weekday?: string;
  focus: string;
  exercises: ExercisePrescription[];
  cardio?: string;
  dailyMovement?: string;
  coachNotes?: string;
  isRecovery?: boolean;
}

export interface DietDay {
  day: number;
  week: number;
  breakfast?: string;
  lunch?: string;
  snack?: string;
  dinner?: string;
  beforeBed?: string;
  target?: string;
}

export interface GuidanceSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

export interface ParsedPlan {
  sourceFileName: string;
  sourceFormat: "daily" | "exercise-level" | "unknown";
  overview: Array<{ label: string; value: string }>;
  days: ScheduleDay[];
  dietDays: DietDay[];
  guidance: GuidanceSection[];
  warnings: ImportWarning[];
  stats: {
    dayCount: number;
    exerciseCount: number;
    dietDayCount: number;
    warningCount: number;
  };
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  focus: string;
  progress: number;
  lastSeen: string;
  weight?: string;
}

export interface PlanAssignment {
  memberId: string;
  memberName: string;
  planName: string;
  startDate: string;
  version: string;
  days: ScheduleDay[];
  dietDays: DietDay[];
  guidance: GuidanceSection[];
}
