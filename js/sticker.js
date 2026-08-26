// The sticker is the one visual idea this whole app is built around:
// completing something = placing a small die-cut, slightly-rotated
// paper sticker, instead of a checkbox or a pill toggle. Used for
// habits (colored by category), and for every other yes/no in the
// app (reflection toggles, goals) using the single brand pink.
//
// Shape variety comes from a small fixed set of asymmetric
// border-radius + rotation presets, picked deterministically from a
// "seed" string (usually the habit key, or key+date for a strip) so
// the same thing always gets the same shape/rotation rather than
// looking identical to its neighbors or re-randomizing on render.

const SHAPES = [
  { radius: "52% 48% 45% 55% / 48% 52% 48% 52%", rotate: -9 },
  { radius: "44% 56% 58% 42% / 52% 46% 54% 48%", rotate: 6 },
  { radius: "55% 45% 48% 52% / 45% 55% 48% 52%", rotate: -4 },
  { radius: "48% 52% 55% 45% / 52% 48% 55% 45%", rotate: 8 },
  { radius: "50% 48% 55% 45% / 48% 52% 46% 54%", rotate: -6 },
];

function shapeFor(seed) {
  let hash = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SHAPES[hash % SHAPES.length];
}

// color: one of "pink" | "mint" | "lavender" | "butter" | "sky" (see styles.css .sticker-slot.c-*)
// interactive: true renders a <button> that toggles on click; false renders an inert <span> (for read-only strips)
export function buildSticker({ color = "pink", on, seed, size = 30, label, onClick, interactive = true }) {
  const shape = shapeFor(seed);
  const node = document.createElement(interactive ? "button" : "span");
  if (interactive) node.type = "button";
  node.className = `sticker-slot${on ? " on" : ""}${interactive ? "" : " static"}`;
  node.style.setProperty("--sticker-radius", shape.radius);
  node.style.setProperty("--sticker-rotate", `${shape.rotate}deg`);
  node.style.setProperty("--sticker-size", `${size}px`);

  if (on) {
    node.classList.add(`c-${color}`);
    node.innerHTML = '<span class="sticker-check" aria-hidden="true">&#10003;</span>';
  } else {
    node.classList.add("empty");
  }

  if (interactive) {
    node.setAttribute("aria-pressed", on ? "true" : "false");
    if (label) node.setAttribute("aria-label", label);
    if (onClick) node.addEventListener("click", onClick);
  } else if (label) {
    node.setAttribute("title", label);
  }

  return node;
}
