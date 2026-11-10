// Small, quiet animations on the Web Animations API (no library needed).
// Everything here is skipped when the computer asks for reduced motion.

const calm = matchMedia("(prefers-reduced-motion: reduce)");
export const reduced = () => calm.matches;

const EASE = "cubic-bezier(.2, .7, .2, 1)"; // fast start, soft landing

/** Fade a page in as one piece. */
export function enter(page) {
  if (reduced() || !page) return;
  page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
}

/** Grow progress bars and rings from empty (or from `fromPct`) to their current value. */
export function fill(root, { fromPct = 0, delay = 120 } = {}) {
  if (reduced() || !root) return;
  const opts = { duration: 800, delay, easing: EASE, fill: "backwards" };
  root.querySelectorAll(".progress > span, .stage-strip .bar span, .thumb .vprog span").forEach((el) => {
    if (!el.style.width || el.style.width === "0%") return;
    el.animate([{ width: fromPct + "%" }, { width: el.style.width }], opts);
  });
  root.querySelectorAll(".ring").forEach((el) => {
    const p = getComputedStyle(el).getPropertyValue("--p").trim();
    if (Number(p) > 0) el.animate([{ "--p": fromPct }, { "--p": p }], opts);
  });
}

/** A short "that registered" bounce. */
export function pop(el, scale = 1.04) {
  if (reduced() || !el) return;
  el.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration: 320, easing: EASE });
}

/** Cross-fade content that just changed (e.g. the timer moving to the next block). */
export function swap(el) {
  if (reduced() || !el) return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
}

/** Draw an SVG path as if by hand. */
export function draw(path, { duration = 1100, delay = 200 } = {}) {
  if (!path) return;
  const len = path.getTotalLength();
  path.style.strokeDasharray = len;
  if (reduced()) return;
  path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, easing: "cubic-bezier(.45, .05, .25, 1)", fill: "backwards" });
}

/** A small message at the bottom of the screen that leaves on its own. */
let toastTimer;
export function toast(html) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add("show");
  if (!reduced()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    pop(el.querySelector("svg"), 1.3);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    const out = reduced() ? null : el.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%, 8px)" }], { duration: 300, easing: "ease-in" });
    const hide = () => el.classList.remove("show");
    out ? (out.onfinish = hide) : hide();
  }, 3200);
}
