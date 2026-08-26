// Loading and saving the data file. There's still no server here —
// entries.json (fetched from ./data/entries.json) remains the
// "published" copy that view.html reads and that push.sh commits.
//
// What's new: every edit is also written to a small localStorage
// draft immediately. That draft is layered on top of entries.json
// whenever the editor loads, so switching days, closing the tab, or
// refreshing the page can never silently lose an edit you haven't
// downloaded and pushed yet. Once you publish (download + push) and
// the site redeploys, the draft and the published file agree and the
// draft stops mattering — you can also clear it manually any time.

import { normalizeStore, normalizeDay } from "./fields.js";

const DATA_PATH = "./data/entries.json";
const DRAFT_KEY = "progress-tracker-draft-v1";

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { days: {}, goals: null };
    const parsed = JSON.parse(raw);
    return {
      days: parsed && typeof parsed.days === "object" ? parsed.days : {},
      goals: Array.isArray(parsed?.goals) ? parsed.goals : null,
    };
  } catch (err) {
    console.error("Could not read local draft, ignoring it.", err);
    return { days: {}, goals: null };
  }
}

function writeDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (err) {
    console.error("Could not save draft locally (storage full or unavailable).", err);
  }
}

// Loads entries.json and layers any unpublished local draft on top.
// Returns the merged store plus whether a draft was actually applied,
// so the UI can tell you "you have local changes not yet published."
export async function loadStore() {
  let base;
  try {
    const res = await fetch(DATA_PATH, { cache: "no-store" });
    base = res.ok ? normalizeStore(await res.json()) : normalizeStore();
  } catch (err) {
    console.error("Could not load entries.json, starting empty.", err);
    base = normalizeStore();
  }

  const draft = readDraft();
  const days = { ...base.days };
  let hasDraft = false;

  Object.entries(draft.days).forEach(([date, day]) => {
    days[date] = normalizeDay(day);
    hasDraft = true;
  });

  let goals = base.goals;
  if (draft.goals) {
    goals = draft.goals.map((g) => ({
      text: typeof g?.text === "string" ? g.text : "",
      done: !!g?.done,
      createdAt: g?.createdAt || date_fallback(),
    }));
    hasDraft = true;
  }

  return { store: { days, goals }, hasDraft };
}

function date_fallback() {
  return new Date().toISOString().slice(0, 10);
}

// Call after any habit/reflection edit for a given day.
export function saveDayDraft(dateKey, day) {
  const draft = readDraft();
  draft.days[dateKey] = normalizeDay(day);
  writeDraft(draft);
}

// Call after any goal add/remove/toggle.
export function saveGoalsDraft(goals) {
  const draft = readDraft();
  draft.goals = goals;
  writeDraft(draft);
}

// Wipes the local draft — useful once you've confirmed entries.json
// on the server matches what you see (i.e. you published and it went
// live), so old drafts don't linger forever in the browser.
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.error("Could not clear local draft.", err);
  }
}

// Triggers a download of the merged data file. The filename is always
// entries.json so you can drop it straight into data/ without renaming.
export function downloadStore(store) {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
