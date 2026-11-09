// Practice session timer, session log and activity heatmap.
import { course, state, save, today, uid, currentWeek, weekState, minutesOn, thisWeekStats } from "./store.js";
import { esc, icon, fmtMin } from "./ui.js";

// Timer state lives at module level so it keeps running while you browse other pages.
export const timer = {
  running: false,
  block: 0,
  remaining: course.cur ? course.cur.dailyBlocks[0].minutes * 60 : 0,
  elapsed: 0, // seconds actually practised this session
  started: false,
  last: 0,
  tick: null,
  week: null,
};
const listeners = new Set();
export const onTick = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

function blocks() {
  return course.cur.dailyBlocks;
}
export function resetTimer() {
  stop();
  Object.assign(timer, { running: false, block: 0, remaining: blocks()[0].minutes * 60, elapsed: 0, started: false });
  emit();
}
function loop() {
  const now = Date.now();
  const dt = Math.round((now - timer.last) / 1000);
  if (dt < 1) return;
  timer.last += dt * 1000;
  timer.remaining -= dt;
  timer.elapsed += dt;
  if (timer.remaining <= 0) {
    chime();
    if (timer.block < blocks().length - 1) {
      timer.block++;
      timer.remaining = blocks()[timer.block].minutes * 60;
    } else {
      timer.remaining = 0;
      stop();
    }
  }
  emit();
}
function start() {
  if (timer.running) return;
  timer.running = true;
  timer.started = true;
  timer.last = Date.now();
  timer.tick = setInterval(loop, 250);
  emit();
}
function stop() {
  timer.running = false;
  clearInterval(timer.tick);
  timer.tick = null;
}
function skip() {
  if (timer.block < blocks().length - 1) {
    timer.block++;
    timer.remaining = blocks()[timer.block].minutes * 60;
  } else {
    timer.remaining = 0;
    stop();
  }
  emit();
}
let audio;
function chime() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(audio.destination);
      const t = audio.currentTime + i * 0.25;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {}
}
export const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

function logSession(minutes, date = today(), note = "") {
  if (!(minutes > 0)) return;
  state.sessions.push({ id: uid(), date, minutes: Math.round(minutes), week: timer.week || currentWeek().id, note });
  save();
}

// ===================== VIEW =====================
let unsub = null;
export function practice(root) {
  const w = currentWeek();
  timer.week = w.id;
  const st = w.stage;
  const ws = weekState(w.id);
  const studyItems = w.study.filter((_, i) => !ws.study[i]);
  const instr = (b) => (b.id === "study" ? (studyItems[0] || w.study[0]) : st.daily[b.id]);

  const render = () => {
    const b = blocks()[timer.block];
    const finished = timer.started && !timer.running && timer.remaining === 0;
    const el = root.querySelector("#timer");
    if (!el) return;
    el.innerHTML = `
      <div class="eyebrow">Week ${w.n} · ${esc(w.title)}</div>
      <div class="clock">${finished ? "Done!" : clock(timer.remaining)}</div>
      <div class="blk">${finished ? "Session complete. Great work." : esc(b.label)}</div>
      <p class="instr">${finished ? "" : esc(instr(b))}</p>
      ${b.id === "gesture" && !finished ? `<p style="margin-top:12px"><a class="btn small" href="https://line-of-action.com" target="_blank" rel="noopener">${icon("ext")} Open Line of Action</a></p>` : ""}
      ${b.id === "study" && !finished ? `<p style="margin-top:12px"><a class="btn small" href="#/week/${w.id}">See this week's exercises</a></p>` : ""}
      <div class="row" style="justify-content:center;margin-top:20px">
        ${finished ? "" : `<button class="btn primary" data-t="toggle">${timer.running ? icon("pause") + " Pause" : icon("play") + (timer.started ? " Resume" : " Start session")}</button>
        <button class="btn" data-t="skip">${icon("next")} Next block</button>`}
        ${timer.started ? `<button class="btn" data-t="log">${icon("check")} Finish & log ${fmtMin(Math.max(1, Math.round(timer.elapsed / 60)))}</button>` : ""}
      </div>
      <div class="timer-steps">${blocks().map((x, i) => `<div class="${i === timer.block && !finished ? "on" : i < timer.block || finished ? "past" : ""}">${esc(x.label)}<br><span class="small">${x.minutes} min</span></div>`).join("")}</div>`;
    el.querySelectorAll("[data-t]").forEach((btn) => {
      btn.onclick = () => {
        const a = btn.dataset.t;
        if (a === "toggle") timer.running ? (stop(), emit()) : start();
        if (a === "skip") skip();
        if (a === "log") {
          logSession(timer.elapsed / 60);
          resetTimer();
          practice(root);
        }
      };
    });
  };

  const tw = thisWeekStats();
  const recent = state.sessions.slice(-12).reverse();
  root.innerHTML = `<div class="stack" style="gap:20px">
    <div class="spread"><div><div class="eyebrow">Practice</div><h1>Today's session</h1></div>
      <span class="badge">${tw.days} of ${course.cur.daysPerWeek} days · ${(tw.minutes / 60).toFixed(1)}h this week</span></div>
    <div class="card timer" id="timer"></div>
    <div class="grid grid-2">
      <div class="card pad stack">
        <h2>Log practice by hand</h2>
        <p class="small muted">Practised away from the computer? Add it here.</p>
        <div class="row">
          <label class="field" style="flex:1">Date<input class="input" type="date" id="l-date" value="${today()}"></label>
          <label class="field" style="width:120px">Minutes<input class="input" type="number" min="5" step="5" id="l-min" value="180"></label>
        </div>
        <label class="field">Note <span class="hint">(optional)</span><input class="input" id="l-note" placeholder="e.g. sketched at the park"></label>
        <button class="btn primary" id="l-add" style="align-self:flex-start">Add to log</button>
      </div>
      <div class="card pad stack">
        <h2>Last 26 weeks</h2>
        <div class="heat">${heat()}</div>
        <div class="small faint">Each square is a day. Darker = longer session.</div>
      </div>
    </div>
    <div class="card pad">
      <h2 style="margin-bottom:10px">Recent sessions</h2>
      ${recent.length ? `<table class="log"><tr><th>Date</th><th>Time</th><th>Week</th><th>Note</th><th></th></tr>${recent.map((s) => `<tr><td>${esc(s.date)}</td><td>${fmtMin(s.minutes)}</td><td>${s.week ? Number(s.week.slice(1)) : ""}</td><td class="muted">${esc(s.note || "")}</td><td><button class="icon-btn" data-del="${esc(s.id)}" aria-label="Delete session">${icon("trash")}</button></td></tr>`).join("")}</table>` : `<div class="empty">No sessions yet. Start the timer above.</div>`}
    </div>
  </div>`;
  render();
  if (unsub) listeners.delete(unsub);
  unsub = render;
  listeners.add(render);

  root.querySelector("#l-add").onclick = () => {
    const m = Number(root.querySelector("#l-min").value);
    if (!(m > 0)) return;
    const save1 = timer.week;
    logSession(m, root.querySelector("#l-date").value || today(), root.querySelector("#l-note").value.trim());
    timer.week = save1;
    practice(root);
  };
  root.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      state.sessions = state.sessions.filter((s) => s.id !== b.dataset.del);
      save();
      practice(root);
    };
  });
}

function heat() {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 26 * 7 + 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // align to Monday
  let out = "";
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const m = minutesOn(today(d));
    const lvl = m === 0 ? "" : m < 60 ? "l1" : m < 150 ? "l2" : "l3";
    out += `<i class="${lvl}" title="${today(d)}: ${m ? fmtMin(m) : "no practice"}"></i>`;
  }
  return out;
}
