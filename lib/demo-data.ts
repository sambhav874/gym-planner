import type { GuidanceSection, Member, PlanAssignment, ScheduleDay } from "./types";

export const members: Member[] = [
  { id: "sambhav", name: "Sambhav Jain", initials: "SJ", focus: "Fat loss + muscle retention", progress: 72, lastSeen: "Logged today", weight: "78 kg" },
  { id: "shivam", name: "Shivam", initials: "S", focus: "Fat loss + muscle gain/retention", progress: 0, lastSeen: "Not logged yet", weight: "78 kg" },
];

const sharedGuidance: GuidanceSection[] = [
  { title: "Coach rules", items: [{ label: "Warm-up", value: "5–8 min easy cardio plus 1–3 progressive warm-up sets." }, { label: "Rest", value: "Compounds 2–3 min. Isolation work 60–90 sec." }, { label: "Progression", value: "When all reps are achieved with good form, add 2.5–5% load." }] },
  { title: "Daily targets", items: [{ label: "Steps", value: "7,000–9,000 steps" }, { label: "Water", value: "2.5–3.0 L" }, { label: "Sleep", value: "7–9 hours" }] },
];

const exercise = (id: string, name: string, muscleGroup: string, sets: string, reps: string, notes: string): ScheduleDay["exercises"][number] => ({ id, exercise: name, muscleGroup, sets, reps, notes });

export const demoDays: ScheduleDay[] = [
  { id: "day-1", planDay: 1, week: 1, weekday: "Monday", focus: "Push A", exercises: [exercise("1", "Barbell bench press", "Chest", "3", "6–10", "Controlled reps. Keep 1–3 reps in reserve."), exercise("2", "Incline dumbbell press", "Chest", "3", "8–12", "Shoulder blades stable."), exercise("3", "Seated shoulder press", "Shoulders", "3", "8–12", "Do not chase failure."), exercise("4", "Cable lateral raise", "Shoulders", "3", "12–15", "No swinging."), exercise("5", "Rope triceps pushdown", "Triceps", "3", "10–15", "Full range of motion.")], cardio: "Incline treadmill · 15–20 min", dailyMovement: "7,000+ steps", coachNotes: "RPE 7. Finish feeling like you could do a little more." },
  { id: "day-2", planDay: 2, week: 1, weekday: "Tuesday", focus: "Pull A", exercises: [exercise("6", "Lat pulldown", "Back", "3", "8–12", "Pull elbows down. Control the return."), exercise("7", "Chest-supported row", "Back", "3", "8–12", "Pause at contraction."), exercise("8", "Seated cable row", "Back", "3", "8–12", "Avoid jerking the torso."), exercise("9", "Face pull", "Rear delts", "3", "12–15", "Keep shoulders relaxed."), exercise("10", "Dumbbell curl", "Biceps", "3", "10–15", "Use a controlled eccentric.")], cardio: "Bike · 15–20 min easy/moderate", dailyMovement: "7,000+ steps", coachNotes: "Focus on back contraction." },
  { id: "day-3", planDay: 3, week: 1, weekday: "Wednesday", focus: "Legs A", exercises: [exercise("11", "Leg press", "Quads", "3", "8–12", "Knees track with toes."), exercise("12", "Romanian deadlift", "Hamstrings", "3", "8–10", "Neutral spine. Hinge at hips."), exercise("13", "Leg curl", "Hamstrings", "3", "10–12", "Control the lowering phase."), exercise("14", "Leg extension", "Quads", "3", "12–15", "Stay smooth under fatigue."), exercise("15", "Standing calf raise", "Calves", "3", "12–15", "Full stretch.")], cardio: "Incline walk · 10–15 min", dailyMovement: "7,000+ steps", coachNotes: "No failure. Keep technique consistent." },
  { id: "day-4", planDay: 4, week: 1, weekday: "Thursday", focus: "Cardio + Recovery", exercises: [exercise("16", "Mobility", "Recovery", "1", "10 min", "Move through comfortable ranges."), exercise("17", "Easy walk or cycle", "Cardio", "1", "30–40 min", "Conversational pace.")], cardio: "Zone 2 · 30–40 min", dailyMovement: "8,000+ steps", coachNotes: "Recovery is part of the program.", isRecovery: true },
  { id: "day-5", planDay: 5, week: 1, weekday: "Friday", focus: "Push B", exercises: [exercise("18", "Incline barbell press", "Chest", "3", "6–10", "Final set can reach RPE 8."), exercise("19", "Machine chest press", "Chest", "3", "8–12", "Keep the range controlled."), exercise("20", "Machine shoulder press", "Shoulders", "3", "8–12", "Avoid locking out aggressively."), exercise("21", "Cable lateral raise", "Shoulders", "3", "12–15", "Lead with the elbows."), exercise("22", "Overhead triceps extension", "Triceps", "3", "10–15", "Keep ribs down.")], cardio: "Treadmill · 15–20 min", dailyMovement: "7,000+ steps", coachNotes: "Progress reps before load." },
  { id: "day-6", planDay: 6, week: 1, weekday: "Saturday", focus: "Pull B", exercises: [exercise("23", "Assisted pull-up", "Back", "3", "8–12", "Avoid momentum."), exercise("24", "One-arm dumbbell row", "Back", "3", "8–12", "Keep hips square."), exercise("25", "Reverse pec deck", "Rear delts", "3", "12–15", "Slow return."), exercise("26", "EZ-bar curl", "Biceps", "3", "10–15", "Full controlled range.")], cardio: "Elliptical · 15–20 min", dailyMovement: "7,000+ steps", coachNotes: "Strict reps." },
  { id: "day-7", planDay: 7, week: 1, weekday: "Sunday", focus: "Rest", exercises: [exercise("27", "Complete rest", "Recovery", "—", "Normal daily movement", "Keep the day easy.")], cardio: "Optional easy walk", dailyMovement: "Normal movement", coachNotes: "Use the day to recover.", isRecovery: true },
];

export const demoAssignment: PlanAssignment = {
  memberId: "sambhav",
  memberName: "Sambhav Jain",
  planName: "30-day fat loss + strength plan",
  startDate: "2026-09-14",
  version: "v1.2",
  days: demoDays,
  dietDays: [
    { day: 1, week: 1, breakfast: "Oats + milk + banana + peanuts", lunch: "3 roti + dal + seasonal sabzi + curd", snack: "Sattu drink + banana", dinner: "Soy rice + vegetables + curd", beforeBed: "250 ml milk", target: "2,250–2,350 kcal · 115–125 g protein · 2.5–3.5 L water" },
  ],
  guidance: sharedGuidance,
};

export const activity = [
  { name: "Sambhav Jain", action: "completed Push A", when: "12 min ago" },
  { name: "Shivam", action: "has a new 30-day plan ready", when: "Today" },
  { name: "Sambhav Jain", action: "published the shared plan", when: "Yesterday" },
];
