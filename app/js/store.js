// Course data + learner progress, saved to the local server (data/progress.json).

export const course = { cur: null, videos: null, weeks: [], weekById: {}, stageById: {} };

const EMPTY = () => ({
  v: 1,
  settings: { name: "", startDate: today(), anime: true, theme: "auto" },
  weeks: {},
  sessions: [],
  rest: [], // dates (YYYY-MM-DD) marked as a planned day off
  uploads: [],
  portfolio: {},
  worksheets: [],
  videos: {}, // per-video watch tracking: { pos, dur, seen: "0110…" (one char per 10-second chunk) }
});

export let state = EMPTY();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

export async function load() {
  const [cur, videos, progress] = await Promise.all([
    fetch("data/curriculum.json").then((r) => r.json()),
    fetch("data/videos.json").then((r) => r.json()),
    fetch("api/progress").then((r) => {
      if (!r.ok) throw new Error("Could not load your progress from the server.");
      return r.json();
    }),
  ]);
  course.cur = cur;
  course.videos = videos;
  course.weeks = [];
  for (const st of cur.stages) {
    course.stageById[st.id] = st;
    for (const w of st.weeks) {
      w.stage = st;
      course.weekById[w.id] = w;
      course.weeks.push(w);
    }
  }
  const base = EMPTY();
  state = { ...base, ...progress, settings: { ...base.settings, ...(progress.settings || {}) } };
  state.videos = state.videos || {};
  state.rest = state.rest || [];
  state._rev = progress._rev || 0; // the revision this copy is based on; sent with every save
}

// ---------- saving ----------
let saveTimer = null;
let saving = Promise.resolve();
export function save() {
  listeners.forEach((fn) => fn());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  saving = saving.then(async () => {
    // Serialise here, not earlier, so each save carries the revision from the previous one.
    const body = JSON.stringify(state);
    try {
      const r = await fetch("api/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      const res = await r.json().catch(() => ({}));
      if (r.status === 409) {
        // Another tab (or an older copy of this one) saved in the meantime: load the newer progress.
        showSave("Your progress changed in another window. Reloading the latest…", true);
        setTimeout(() => location.reload(), 1500);
        return;
      }
      if (!r.ok) throw new Error(res.error || r.statusText);
      state._rev = res.rev;
      showSave("Saved");
    } catch (e) {
      showSave("Not saved. Is the app's server window still open? " + e.message, true);
    }
  });
  return saving;
}
let hideTimer;
function showSave(msg, err = false) {
  const el = document.getElementById("save-state");
  if (!el) return;
  el.textContent = msg;
  el.className = "save-state show" + (err ? " err" : "");
  clearTimeout(hideTimer);
  if (!err) hideTimer = setTimeout(() => (el.className = "save-state"), 1200);
}
window.addEventListener("beforeunload", () => {
  if (saveTimer) navigator.sendBeacon?.("api/progress", new Blob([JSON.stringify(state)], { type: "application/json" }));
});

// ---------- helpers ----------
export function today(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function weekState(id) {
  if (!state.weeks[id]) state.weeks[id] = { videos: {}, study: {}, done: false, notes: "" };
  return state.weeks[id];
}

// ---------- video watch tracking ----------
export const CHUNK = 10; // seconds per tracked chunk
export function videoTrack(id) {
  return state.videos[id] || null;
}
/** Share of the video actually played (0–100), counting each 10-second chunk once. */
export function videoPct(id) {
  const t = state.videos[id];
  if (!t || !t.dur) return 0;
  const total = Math.ceil(t.dur / CHUNK);
  const seen = (t.seen || "").split("").filter((c) => c === "1").length;
  return Math.min(100, Math.round((seen / total) * 100));
}
/** Record a playback position. Returns true when a new chunk was seen. */
export function trackVideo(id, pos, dur, playing) {
  const t = (state.videos[id] = state.videos[id] || { pos: 0, dur: 0, seen: "" });
  if (dur > 0) t.dur = Math.round(dur);
  t.pos = Math.round(pos);
  t.at = Date.now();
  if (!playing || !t.dur) return false;
  const total = Math.ceil(t.dur / CHUNK);
  const seen = (t.seen || "").padEnd(total, "0").slice(0, total).split("");
  const i = Math.min(total - 1, Math.floor(pos / CHUNK));
  if (seen[i] === "1") return false;
  seen[i] = "1";
  t.seen = seen.join("");
  return true;
}

export function visibleVideos(w) {
  return w.videos.filter((v) => state.settings.anime || !v.anime);
}

export function uploadsFor(filter) {
  return state.uploads.filter((u) => Object.entries(filter).every(([k, v]) => u[k] === v));
}

/** Items that count towards a week's completion. */
export function weekItems(w) {
  const ws = state.weeks[w.id] || { videos: {}, study: {} };
  const items = [];
  for (const v of w.videos) {
    if (v.optional || v.anime) continue;
    items.push(!!ws.videos[v.id]);
  }
  w.study.forEach((_, i) => items.push(!!ws.study[i]));
  // In benchmark weeks the benchmark set is the assignment, so it isn't counted twice.
  if (w.assignment && !w.benchmark) items.push(uploadsFor({ week: w.id, kind: "assignment" }).length > 0);
  if (w.benchmark) {
    const n = course.cur.benchmark.items.filter((b) => uploadsFor({ week: w.id, kind: "benchmark", slot: b.id }).length).length;
    items.push(n === course.cur.benchmark.items.length);
  }
  return items;
}
export function weekPct(w) {
  if (state.weeks[w.id]?.done) return 100;
  const items = weekItems(w);
  return items.length ? Math.round((items.filter(Boolean).length / items.length) * 100) : 0;
}
export const isDone = (w) => !!state.weeks[w.id]?.done;

export function currentWeek() {
  return course.weeks.find((w) => !isDone(w)) || course.weeks[course.weeks.length - 1];
}
export function stagePct(st) {
  return Math.round(st.weeks.reduce((a, w) => a + weekPct(w), 0) / st.weeks.length);
}
export function overallPct() {
  return Math.round(course.weeks.reduce((a, w) => a + weekPct(w), 0) / course.weeks.length);
}

// ---------- session plans ----------
/** The daily blocks for a session plan ("full", "short", "quick"), with that plan's minutes. */
export function planBlocks(planId = "full") {
  const plans = course.cur.sessionPlans || [];
  const plan = plans.find((p) => p.id === planId) || plans[0];
  if (!plan) return course.cur.dailyBlocks;
  return course.cur.dailyBlocks.filter((b) => plan.minutes[b.id]).map((b) => ({ ...b, minutes: plan.minutes[b.id] }));
}
export const planMinutes = (planId) => planBlocks(planId).reduce((a, b) => a + b.minutes, 0);

// ---------- rest days ----------
export const isRest = (date = today()) => state.rest.includes(date);
export function setRest(on, date = today()) {
  state.rest = state.rest.filter((d) => d !== date);
  if (on) state.rest.push(date);
  save();
}

// ---------- practice stats ----------
export function minutesOn(date) {
  return state.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
}
function mondayOf(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function thisWeekStats() {
  const mon = mondayOf(new Date());
  const days = new Set();
  let minutes = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const m = minutesOn(today(d));
    if (m > 0) days.add(i);
    minutes += m;
  }
  return { days: days.size, minutes };
}
/** Consecutive weeks (ending this week or last) with at least 4 practice days. */
export function weekStreak() {
  let streak = 0;
  const mon = mondayOf(new Date());
  for (let k = 0; k < 104; k++) {
    const start = new Date(mon);
    start.setDate(mon.getDate() - 7 * k);
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (minutesOn(today(d)) > 0) days++;
    }
    if (days >= 4) streak++;
    else if (k === 0) continue; // this week may still be in progress
    else break;
  }
  return streak;
}
export function totalMinutes() {
  return state.sessions.reduce((a, s) => a + s.minutes, 0);
}

// ---------- uploads ----------
/** Downscale big photos to a JPEG (max 2400px) so the data folder stays small. */
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp|heic)$/.test(file.type) || file.size < 1.5e6) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // browser can't decode it (e.g. HEIC outside Safari) — upload as-is
  }
}
export async function upload(file, meta) {
  const blob = await shrink(file);
  const r = await fetch("api/uploads", { method: "POST", headers: { "Content-Type": blob.type || file.type }, body: blob });
  const res = await r.json();
  if (!r.ok) throw new Error(res.error || "Upload failed");
  const u = { id: uid(), file: res.file, url: res.url, date: today(), star: false, caption: "", ...meta };
  state.uploads.push(u);
  save();
  return u;
}
export async function removeUpload(id) {
  const u = state.uploads.find((x) => x.id === id);
  if (!u) return;
  await fetch("api/uploads/" + encodeURIComponent(u.file), { method: "DELETE" });
  state.uploads = state.uploads.filter((x) => x.id !== id);
  save();
}
