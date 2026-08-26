// Entry point for view.html — the read-only page you share. No login,
// no edit controls. Shows current streaks and the full reflection log
// for recent days, formatted for reading.

import { HABITS, REFLECTION_FIELDS, parseDateKey, todayKey, normalizeStore, earliestDateKey } from "./fields.js";
import { loadStore } from "./store.js";
import { allStreaks, lastNDays } from "./streaks.js";
import { buildSticker } from "./sticker.js";

const STREAK_STRIP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  selectedDate: todayKey(),
  trackingStartDate: todayKey(), // set in init() from the earliest logged day
  store: null,
};

function dateValue(key) {
  return parseDateKey(key).getTime();
}

function latestCompletedDateKey(days, fallback) {
  const completed = Object.keys(days || {})
    .filter((date) => days[date])
    .sort((a, b) => dateValue(a) - dateValue(b));
  return completed.length ? completed[completed.length - 1] : fallback;
}

function addDays(key, delta) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

// Small check/cross glyph used next to any dropdown heading whose
// underlying answer is yes/no, mirroring the editor's tick/cross.
function fieldStateIcon(on) {
  return el("span", { class: `field-state ${on ? "yes" : "no"}`, "aria-hidden": "true" }, [on ? "\u2713" : "\u2715"]);
}

// Which reflection fields have a clear yes/no to show as an icon.
// Returns null for fields with no boolean (mood, free text, etc).
function booleanStateFor(field, reflection) {
  if (field.type === "toggleNote") {
    const v = reflection?.[field.key];
    return v ? !!v.done : null;
  }
  if (field.type === "saidDid") {
    return !!reflection?.followThrough?.did;
  }
  return null;
}

// Recent days to show, clamped so it never reaches back before
// tracking actually started — before that there's nothing to show as
// a gap, because there was nothing being tracked yet.
function clampedRecentDays(days, selectedDate, trackingStart, maxDays) {
  const selected = parseDateKey(selectedDate);
  const start = parseDateKey(trackingStart);
  const elapsedDays = Math.max(1, Math.floor((selected - start) / DAY_MS) + 1);
  return lastNDays(days, Math.min(elapsedDays, maxDays), selected);
}

function renderStreaks(days) {
  const grid = document.getElementById("streak-grid");
  grid.innerHTML = "";
  const recentDays = clampedRecentDays(days, state.selectedDate, state.trackingStartDate, STREAK_STRIP_DAYS);

  allStreaks(days, parseDateKey(state.selectedDate)).forEach((h) => {
    const row = el("div", { class: "streak-row" });
    row.appendChild(el("div", { class: "streak-row-label" }, [h.label]));

    const strip = el("div", { class: "streak-strip" });
    recentDays.forEach(({ date, entry }) => {
      const on = !!(entry && entry.habits && entry.habits[h.key]);
      strip.appendChild(
        buildSticker({
          color: h.color,
          on,
          seed: `${h.key}-${date}`,
          size: 18,
          interactive: false,
          label: `${h.label}, ${date}: ${on ? "done" : "not logged"}`,
        })
      );
    });
    row.appendChild(strip);

    row.appendChild(el("div", { class: "streak-row-count" }, [h.streak > 0 ? `${h.streak}d` : "\u2014"]));
    grid.appendChild(row);
  });
}

function renderDateHeader() {
  const label = document.getElementById("date-label");
  const picker = document.getElementById("day-picker");
  const date = parseDateKey(state.selectedDate);
  label.textContent = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (picker) picker.value = state.selectedDate;
}

function setSelectedDate(dateKey) {
  state.selectedDate = dateKey;
  renderDateHeader();
  updateDayNavControls();
  renderStreaks(state.store.days);
  renderNotes(state.store.days);
  renderGoals(state.store.goals);
}

// Turns one reflection field's stored value into a { label, value }
// pair for display, or null if there's nothing worth showing.
function formatField(field, reflection) {
  const value = reflection ? reflection[field.key] : null;

  if (field.key === "mood") {
    return value ? { label: field.label, value: `${value} / 5` } : null;
  }
  if (field.type === "toggleNote") {
    if (!value || (!value.done && !value.note)) return null;
    const yn = value.done ? "Yes" : "No";
    return { label: field.label, value: value.note ? `${yn} — ${value.note}` : yn };
  }
  if (field.type === "saidDid") {
    if (!value || (!value.said && !value.did)) return null;
    const yn = value.did ? "Yes" : "No";
    return { label: field.label, value: value.said ? `"${value.said}" — did it: ${yn}` : `Did it: ${yn}` };
  }
  // plain text fields, including moodNote
  return value ? { label: field.label, value } : null;
}

function renderNotes(days) {
  const container = document.getElementById("recent-notes");
  container.innerHTML = "";
  const recent = clampedRecentDays(days, state.selectedDate, state.trackingStartDate, 7);

  recent.forEach(({ date, entry }) => {
    const label = parseDateKey(date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    const fieldsWrap = el("div", { class: "note-fields" });
    let any = false;

    if (entry) {
      REFLECTION_FIELDS.forEach((f) => {
        const result = formatField(f, entry.reflection);
        if (!result) return;
        any = true;

        // Mood is just a number — showing it plainly next to the
        // label is more useful than hiding it behind a tap.
        if (f.key === "mood") {
          fieldsWrap.appendChild(
            el("div", { class: "field-note" }, [
              el("div", { class: "field-static-row" }, [
                el("span", { class: "field-label-text" }, [f.label]),
                el("span", { class: "field-static-value" }, [result.value]),
              ]),
            ])
          );
          return;
        }

        const summaryChildren = [el("span", { class: "field-label-text" }, [f.label])];

        const boolState = booleanStateFor(f, entry.reflection);
        if (boolState !== null) summaryChildren.push(fieldStateIcon(boolState));

        summaryChildren.push(el("span", { class: "note-chevron small", "aria-hidden": "true" }));

        const isNarrative = f.type === "text";
        fieldsWrap.appendChild(
          el("details", { class: "field-note" }, [
            el("summary", { class: "field-summary" }, summaryChildren),
            el("div", { class: "field-body" }, [
              el("p", { class: `line-value${isNarrative ? " narrative" : ""}` }, [result.value]),
            ]),
          ])
        );
      });
    }

    if (any) {
      const dayBlock = el("details", { class: "note-day", ...(date === state.selectedDate ? { open: "" } : {}) }, [
        el("summary", { class: "note-summary" }, [
          el("span", { class: "day-heading" }, [label]),
          el("span", { class: "note-chevron", "aria-hidden": "true" }),
        ]),
      ]);
      dayBlock.appendChild(fieldsWrap);
      container.appendChild(dayBlock);
    } else {
      // A real gap: no reflection was logged this day. Show it
      // plainly instead of hiding it — there's nothing to expand, so
      // no chevron, no interaction.
      container.appendChild(
        el("div", { class: "note-day empty" }, [
          el("div", { class: "note-summary" }, [
            el("span", { class: "day-heading muted" }, [label]),
            el("span", { class: "note-empty-text" }, ["Nothing logged"]),
          ]),
        ])
      );
    }
  });
}

function renderGoals(goals) {
  const list = document.getElementById("goals-list");
  list.innerHTML = "";
  if (!goals || goals.length === 0) {
    list.appendChild(el("p", { class: "empty-note" }, ["Nothing listed yet."]));
    return;
  }
  goals.forEach((g) => {
    list.appendChild(
      el("div", { class: `goal-item${g.done ? " done" : ""}` }, [
        el("span", { class: "goal-status" }, [g.done ? "Done" : "Open"]),
        el("span", { class: "goal-text" }, [g.text]),
        el("span", { class: "goal-meta" }, [g.createdAt || ""]),
      ])
    );
  });
}

function updateDayNavControls() {
  const picker = document.getElementById("day-picker");
  const prevBtn = document.getElementById("prev-day-btn");
  if (picker) picker.min = state.trackingStartDate;
  if (prevBtn) prevBtn.disabled = dateValue(state.selectedDate) <= dateValue(state.trackingStartDate);
}

function setupDayControls() {
  const picker = document.getElementById("day-picker");
  const stepDate = (delta) => {
    const next = addDays(state.selectedDate, delta);
    setSelectedDate(next);
  };

  document.getElementById("prev-day-btn").addEventListener("click", () => stepDate(-1));
  document.getElementById("next-day-btn").addEventListener("click", () => stepDate(1));
  document.getElementById("today-day-btn").addEventListener("click", () => setSelectedDate(latestCompletedDateKey(state.store.days, state.trackingStartDate)));
  picker.addEventListener("change", (e) => {
    if (e.target.value) setSelectedDate(e.target.value);
  });
}

function showLoadNote(message) {
  const el = document.getElementById("load-note");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

function setupTabs() {
  const buttons = document.querySelectorAll("nav.tabs button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`${btn.dataset.tab}-panel`).classList.add("active");
    });
  });
}

async function init() {
  const { store } = await loadStore();
  state.store = normalizeStore(store);
  state.trackingStartDate = earliestDateKey(state.store.days);
  state.selectedDate = latestCompletedDateKey(state.store.days, state.trackingStartDate);

  renderDateHeader();
  updateDayNavControls();
  const latestButton = document.getElementById("today-day-btn");
  if (latestButton) latestButton.textContent = "Latest";

  if (window.location.protocol === "file:") {
    showLoadNote("Open this view through a local web server, e.g. npx serve ., so the browser can read entries.json.");
  } else {
    showLoadNote("");
  }

  renderStreaks(state.store.days);
  renderNotes(state.store.days);
  renderGoals(state.store.goals);
  setupDayControls();
  setupTabs();
}

init();
