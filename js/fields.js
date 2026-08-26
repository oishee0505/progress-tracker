// Single source of truth for what fields exist on each page.
// Add, rename, or remove a habit or reflection field only here —
// editor.js, view.js, and streaks.js all read from this file.

// color picks which pastel sticker this habit gets (see styles.css
// .sticker-slot.c-*). Deliberately cycled so no two neighbors match.
export const HABITS = [
  { key: "alcoholFree", label: "Alcohol-free day", color: "pink" },
  { key: "exercise", label: "Exercise or movement", color: "mint" },
  { key: "cookedHome", label: "Cooked at home", color: "butter" },
  { key: "meditation", label: "Meditation or self-reflection", color: "lavender" },
  { key: "sleepConsistent", label: "Consistent sleep", color: "sky" },
  { key: "keptCommitment", label: "Kept a commitment to myself", color: "pink" },
  { key: "readLearned", label: "Read or learned something", color: "mint" },
  { key: "aloneTime", label: "Time alone, no distractions", color: "lavender" },
  { key: "kindness", label: "An act of kindness", color: "butter" },
  { key: "gratitude", label: "Noticed something to be grateful for", color: "sky" },
];

// type: "toggleNote" -> yes/no plus an optional line of text
//       "text"       -> free-form line or paragraph (set multiline: true for a textarea)
//       "scale"      -> 1-5 picker
//       "saidDid"    -> a "said" text field plus a "did" yes/no
export const REFLECTION_FIELDS = [
  { key: "mood", type: "scale", label: "Mood today" },
  { key: "moodNote", type: "text", label: "One line on why", multiline: false },
  { key: "honesty", type: "toggleNote", label: "Was I fully honest today", noteLabel: "If not, what happened" },
  { key: "followThrough", type: "saidDid", label: "Follow-through", saidLabel: "What I said I'd do", didLabel: "Did I do it" },
  { key: "nicotine", type: "text", label: "Nicotine", multiline: true },
  { key: "savedMoney", type: "toggleNote", label: "Saved money today", noteLabel: "What I did instead of spending" },
  { key: "parentsConvo", type: "toggleNote", label: "Talked with my parents", noteLabel: "How it went" },
  { key: "good", type: "text", label: "What was good today", multiline: true },
  { key: "hard", type: "text", label: "What was hard today", multiline: true },
  { key: "learning", type: "text", label: "What I'm learning about myself", multiline: true },
  { key: "patience", type: "toggleNote", label: "A moment I wanted to react badly, and didn't", noteLabel: "What happened" },
  { key: "valueLived", type: "text", label: "A value I lived by today", multiline: false },
  { key: "freeWrite", type: "text", label: "Free write", multiline: true },
];

// Pastel tint per mood level, reusing the same sticker color system
// rather than introducing a new palette — level 1 (roughest) through
// 5 (best) each borrow one of the existing sticker colors.
export const MOOD_TINTS = {
  1: { face: "var(--sticker-sky-face)", text: "var(--sticker-sky-text)" },
  2: { face: "var(--sticker-lavender-face)", text: "var(--sticker-lavender-text)" },
  3: { face: "var(--sticker-butter-face)", text: "var(--sticker-butter-text)" },
  4: { face: "var(--sticker-mint-face)", text: "var(--sticker-mint-text)" },
  5: { face: "var(--sticker-pink-face)", text: "var(--sticker-pink-text)" },
};

export function calendarTodayKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(date = new Date()) {
  return calendarTodayKey(date);
}

// Turns a "YYYY-MM-DD" key back into a Date, safely. Never use
// `new Date(dateString)` directly on these keys — the JS spec parses
// bare date strings as UTC midnight, which then renders as the wrong
// day (often one day earlier) once your local timezone is behind UTC.
// This constructs the Date from local parts instead, so it always
// matches the key you stored.
export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Shape of a single day's entry.
export function emptyDay() {
  const habits = {};
  HABITS.forEach((h) => (habits[h.key] = false));
  const reflection = {
    mood: null,
    moodNote: "",
    honesty: { done: false, note: "" },
    followThrough: { said: "", did: false },
    nicotine: "",
    savedMoney: { done: false, note: "" },
    parentsConvo: { done: false, note: "" },
    good: "",
    hard: "",
    learning: "",
    patience: { done: false, note: "" },
    valueLived: "",
    freeWrite: "",
  };
  return { habits, reflection };
}

// Shape of the whole data file: day entries keyed by date, plus a
// running goals list that isn't tied to any single day.
export function normalizeReflection(reflection = {}) {
  const base = emptyDay().reflection;
  const next = { ...base, ...(reflection || {}) };

  Object.keys(base).forEach((key) => {
    const baseValue = base[key];
    const currentValue = reflection?.[key];
    if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)) {
      next[key] = { ...baseValue, ...(currentValue && typeof currentValue === "object" ? currentValue : {}) };
    }
  });

  return next;
}

export function normalizeDay(day = {}) {
  const base = emptyDay();
  const habits = { ...base.habits, ...(day.habits || {}) };
  const reflection = normalizeReflection(day.reflection || {});
  return { habits, reflection };
}

export function normalizeStore(store = {}) {
  const rawDays = store.days && typeof store.days === "object" ? store.days : {};
  const days = Object.fromEntries(
    Object.entries(rawDays).map(([date, day]) => [date, normalizeDay(day)])
  );

  const goals = Array.isArray(store.goals)
    ? store.goals.map((goal) => ({
        text: typeof goal?.text === "string" ? goal.text : "",
        done: !!goal?.done,
        createdAt: goal?.createdAt || todayKey(),
      }))
    : [];

  return { days, goals };
}

export function emptyStore() {
  return { days: {}, goals: [] };
}

// Earliest date key with a logged entry, or today if nothing's logged
// yet. Used to anchor rolling windows (like view.js's 3-day summary)
// without hardcoding a start date that has to be hand-edited later.
export function earliestDateKey(days, fallback = todayKey()) {
  const keys = Object.keys(days || {});
  if (!keys.length) return fallback;
  return keys.sort((a, b) => parseDateKey(a) - parseDateKey(b))[0];
}

// Most recent date key with a logged entry, or the fallback if
// nothing's logged yet. Used so the app opens on your last real entry
// instead of a blank "today" the moment the calendar rolls over.
export function latestDateKey(days, fallback = todayKey()) {
  const keys = Object.keys(days || {});
  if (!keys.length) return fallback;
  return keys.sort((a, b) => parseDateKey(a) - parseDateKey(b))[keys.length - 1];
}
