// Streak and rollup math, shared by editor.js (so you can see your
// own streaks while logging) and view.js (so he sees them too).

import { HABITS, todayKey } from "./fields.js";

function keyFromDate(date) {
  return todayKey(date);
}

// Current streak for one habit, counting back from today. Breaks the
// moment a day is missing or false.
export function currentStreak(days, habitKey, from = new Date()) {
  let streak = 0;
  let cursor = new Date(from);
  for (;;) {
    const key = keyFromDate(cursor);
    const day = days[key];
    if (day && day.habits && day.habits[habitKey]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function allStreaks(days, from = new Date()) {
  return HABITS.map((h) => ({ ...h, streak: currentStreak(days, h.key, from) }));
}

// Returns entries for the last N calendar days (including today),
// oldest first, whether or not a day has data.
export function lastNDays(days, n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() - i);
    const key = keyFromDate(cursor);
    out.push({ date: key, entry: days[key] || null });
  }
  return out;
}

// Percentage of habits completed for a single day (0-100), or null if
// no entry exists for that day.
export function dayCompletionRate(day) {
  if (!day || !day.habits) return null;
  const values = HABITS.map((h) => !!day.habits[h.key]);
  const done = values.filter(Boolean).length;
  return Math.round((done / HABITS.length) * 100);
}
