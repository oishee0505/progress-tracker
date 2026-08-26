// Entry point for index.html — your private daily editor. No login,
// no backend: it loads data/entries.json (plus any local draft), lets
// you pick a day, autosaves as you type, and lets you download an
// updated file whenever you're ready to publish it.

import { HABITS, REFLECTION_FIELDS, todayKey, emptyDay, normalizeDay, parseDateKey, earliestDateKey, latestDateKey, MOOD_TINTS } from "./fields.js";
import { loadStore, downloadStore, saveDayDraft, saveGoalsDraft, clearDraft } from "./store.js";
import { allStreaks } from "./streaks.js";
import { buildSticker } from "./sticker.js";

const state = {
  store: null,
  today: todayKey(),
  day: null,
  streaksByKey: {},
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Any edit funnels through here. Habits/reflection changes mutate
// state.day, which is the SAME object as state.store.days[state.today]
// (see setActiveDate below), so the in-memory store is always current.
// This just makes sure the browser also remembers it if you close the
// tab or switch days before publishing.
const persistDay = debounce(() => saveDayDraft(state.today, state.day), 300);
const persistGoals = debounce(() => saveGoalsDraft(state.store.goals), 300);

function markAutosaved() {
  const note = document.getElementById("autosave-note");
  if (note) note.textContent = "Saved locally";
}

function renderHabits(streaksByKey) {
  const list = document.getElementById("habits-list");
  list.innerHTML = "";
  HABITS.forEach((h) => {
    const on = !!state.day.habits[h.key];
    const streak = streaksByKey[h.key] || 0;
    const row = el("div", { class: `habit-row${on ? " on" : ""}` });
    const sticker = buildSticker({
      color: h.color,
      on,
      seed: h.key,
      size: 32,
      label: h.label,
      onClick: () => {
        state.day.habits[h.key] = !state.day.habits[h.key];
        renderHabits(streaksByKey);
        persistDay();
        markAutosaved();
      },
    });
    row.appendChild(sticker);
    row.appendChild(el("div", { class: "label" }, [h.label]));
    row.appendChild(el("div", { class: "streak" }, [streak > 0 ? `${streak}d` : ""]));
    list.appendChild(row);
  });
}

function renderDateHeader() {
  const label = document.getElementById("date-label");
  const picker = document.getElementById("day-picker");
  const date = parseDateKey(state.today);
  label.textContent = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (picker) picker.value = state.today;
}

function updateSaveLabel() {
  const btn = document.getElementById("save-btn");
  if (!btn) return;
  const isToday = state.today === todayKey();
  const label = parseDateKey(state.today).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  btn.textContent = isToday ? "Download entries.json" : `Download entries.json (editing ${label})`;
}

// Nothing exists before your first logged day, so don't let day-nav
// wander into empty pre-tracking dates.
function updateNavControls() {
  const start = earliestDateKey(state.store.days, state.today);
  const picker = document.getElementById("day-picker");
  const prevBtn = document.getElementById("prev-day-btn");
  if (picker) picker.min = start;
  if (prevBtn) prevBtn.disabled = state.today <= start;
}

function setActiveDate(dateKey) {
  state.today = dateKey;
  // normalizeDay always returns a fresh object — assign it straight
  // back into the store so state.day and state.store.days[dateKey]
  // are the SAME object. Every subsequent edit mutates that object in
  // place, so it's already reflected in state.store the instant it
  // happens. Switching to another day and back no longer loses
  // anything.
  state.day = normalizeDay(state.store.days[state.today] || emptyDay());
  state.store.days[state.today] = state.day;

  renderDateHeader();
  updateSaveLabel();
  updateNavControls();
  state.streaksByKey = Object.fromEntries(allStreaks(state.store.days, parseDateKey(state.today)).map((s) => [s.key, s.streak]));
  renderHabits(state.streaksByKey);
  renderReflection();
  renderGoals();
}

function toggleNoteField(field, value) {
  const wrap = el("div", { class: "field" });
  const row = el("div", { class: "inline-toggle-row" });
  row.appendChild(el("label", { class: "field-label" }, [field.label]));
  row.appendChild(
    buildSticker({
      color: "pink",
      on: value.done,
      seed: field.key,
      size: 26,
      label: field.label,
      onClick: () => {
        value.done = !value.done;
        renderReflection();
        persistDay();
        markAutosaved();
      },
    })
  );
  wrap.appendChild(row);
  const note = el("input", {
    type: "text",
    placeholder: field.noteLabel || "Notes",
    oninput: (e) => {
      value.note = e.target.value;
      persistDay();
      markAutosaved();
    },
  });
  note.value = value.note || "";
  wrap.appendChild(note);
  return wrap;
}

function renderMoodTicks(r) {
  const wrap = el("div", { class: "field" }, [el("label", { class: "field-label" }, ["Mood today"])]);
  const scale = el("div", { class: "mood-ticks" });
  scale.appendChild(el("div", { class: "mood-ticks-line" }));
  const options = el("div", { class: "mood-ticks-options" });
  [1, 2, 3, 4, 5].forEach((n) => {
    const tint = MOOD_TINTS[n];
    const tick = el("button", {
      class: `mood-tick${r.mood === n ? " selected" : ""}`,
      type: "button",
      style: `--mood-face:${tint.face}; --mood-text:${tint.text};`,
      onclick: () => {
        r.mood = n;
        renderReflection();
        persistDay();
        markAutosaved();
      },
    }, [el("span", { class: "mark" }), el("span", { class: "n" }, [String(n)])]);
    options.appendChild(tick);
  });
  scale.appendChild(options);
  wrap.appendChild(scale);
  return wrap;
}

function renderReflection() {
  const container = document.getElementById("reflection-fields");
  container.innerHTML = "";
  const r = state.day.reflection;

  REFLECTION_FIELDS.forEach((field) => {
    if (field.key === "mood") {
      container.appendChild(renderMoodTicks(r));
      return;
    }

    if (field.type === "toggleNote") {
      container.appendChild(toggleNoteField(field, r[field.key]));
      return;
    }

    if (field.type === "saidDid") {
      const wrap = el("div", { class: "field" }, [el("label", { class: "field-label" }, [field.label])]);
      const said = el("input", {
        type: "text",
        placeholder: field.saidLabel,
        oninput: (e) => {
          r.followThrough.said = e.target.value;
          persistDay();
          markAutosaved();
        },
      });
      said.value = r.followThrough.said || "";
      wrap.appendChild(said);
      const row = el("div", { class: "inline-toggle-row" }, [el("label", { class: "field-label" }, [field.didLabel])]);
      row.appendChild(
        buildSticker({
          color: "pink",
          on: r.followThrough.did,
          seed: "followThrough",
          size: 26,
          label: field.didLabel,
          onClick: () => {
            r.followThrough.did = !r.followThrough.did;
            renderReflection();
            persistDay();
            markAutosaved();
          },
        })
      );
      wrap.appendChild(row);
      container.appendChild(wrap);
      return;
    }

    // plain text field — covers moodNote and every other free-text
    // reflection field; there's no need for a field-specific branch.
    const wrap = el("div", { class: "field" }, [el("label", { class: "field-label" }, [field.label])]);
    const input = el(field.multiline ? "textarea" : "input", {
      oninput: (e) => {
        r[field.key] = e.target.value;
        persistDay();
        markAutosaved();
      },
    });
    if (!field.multiline) input.type = "text";
    input.value = r[field.key] || "";
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
}

function renderGoals() {
  const list = document.getElementById("goals-list");
  list.innerHTML = "";
  if (state.store.goals.length === 0) {
    list.appendChild(el("p", { class: "empty-note" }, ["Nothing on the list yet."]));
  }
  state.store.goals.forEach((g, idx) => {
    const item = el("div", { class: `goal-item${g.done ? " done" : ""}` });
    item.appendChild(
      buildSticker({
        color: "pink",
        on: g.done,
        seed: `goal-${idx}`,
        size: 24,
        label: g.done ? "Mark not done" : "Mark done",
        onClick: () => {
          g.done = !g.done;
          renderGoals();
          persistGoals();
          markAutosaved();
        },
      })
    );
    item.appendChild(el("span", { class: "goal-text" }, [g.text]));
    item.appendChild(
      el("button", {
        "aria-label": "Remove",
        class: "goal-remove",
        onclick: () => {
          state.store.goals.splice(idx, 1);
          renderGoals();
          persistGoals();
          markAutosaved();
        },
      }, ["\u00d7"])
    );
    list.appendChild(item);
  });
}

function setupDateControls() {
  const picker = document.getElementById("day-picker");
  const stepDate = (delta) => {
    const next = parseDateKey(state.today);
    next.setDate(next.getDate() + delta);
    setActiveDate(todayKey(next));
  };

  document.getElementById("prev-day-btn").addEventListener("click", () => stepDate(-1));
  document.getElementById("next-day-btn").addEventListener("click", () => stepDate(1));
  document.getElementById("today-day-btn").addEventListener("click", () => setActiveDate(todayKey()));
  picker.addEventListener("change", (e) => {
    if (e.target.value) setActiveDate(e.target.value);
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

function setupGoalAdd() {
  const input = document.getElementById("new-goal-input");
  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    state.store.goals.push({ text, done: false, createdAt: todayKey() });
    input.value = "";
    renderGoals();
    persistGoals();
    markAutosaved();
  };
  document.getElementById("add-goal-btn").addEventListener("click", add);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
}

function setupSave() {
  document.getElementById("save-btn").addEventListener("click", () => {
    downloadStore(state.store);
    const note = document.getElementById("save-note");
    note.textContent = "Downloaded entries.json — move it into data/ and push to update the shared view.";
  });

  const clearBtn = document.getElementById("clear-draft-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!window.confirm("Clear local draft? Only do this once entries.json on the live site already matches what you see here.")) return;
      clearDraft();
      const note = document.getElementById("save-note");
      note.textContent = "Local draft cleared.";
    });
  }
}

async function init() {
  const { store, hasDraft } = await loadStore();
  state.store = store;

  if (window.location.protocol === "file:") {
    showLoadNote("Open this app through a local web server, e.g. npx serve ., so the browser can read entries.json.");
  } else if (hasDraft) {
    showLoadNote("Showing local changes not yet published — download and push when ready.");
  } else {
    showLoadNote("");
  }

  setActiveDate(latestDateKey(state.store.days, state.today));
  setupDateControls();
  setupTabs();
  setupGoalAdd();
  setupSave();
}

init();
