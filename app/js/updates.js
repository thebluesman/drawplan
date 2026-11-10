// Background update check: asks the local server (which asks GitHub) whether a newer version exists,
// and marks the page with `html.has-update` so the Settings icon and the mobile menu button show a dot.

const EVERY = 6 * 60 * 60 * 1000; // check every 6 hours while the app is open
const listeners = new Set();
export const update = { available: false, checkedAt: 0 };

export const onUpdate = (fn) => listeners.add(fn);

function set(available) {
  update.available = available;
  update.checkedAt = Date.now();
  document.documentElement.classList.toggle("has-update", available);
  listeners.forEach((fn) => fn(update));
}

/** Returns the server's answer. `fresh` skips the server's cache (the Settings button). Throws on failure. */
export async function checkForUpdate(fresh = false) {
  const r = await fetch(fresh ? "api/update?fresh=1" : "api/update", { cache: "no-store" });
  const res = await r.json();
  if (!r.ok) throw new Error(res.error);
  set(!!res.available);
  return res;
}

let pending = null; // one background check at a time (a tab shown during load would start a second)
const quietCheck = () => (pending ||= checkForUpdate().catch(() => {}).finally(() => (pending = null))); // offline is fine: try again next time

export function startUpdateChecks() {
  quietCheck();
  setInterval(quietCheck, EVERY);
  // Timers stop while a laptop sleeps or a phone tab sits in the background, so also check on return.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - update.checkedAt > EVERY) quietCheck();
  });
}
