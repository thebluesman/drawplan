import {
  course, state, save, flush, today, uid, weekState, visibleVideos, uploadsFor, weekPct, isDone,
  currentWeek, stagePct, overallPct, thisWeekStats, weekStreak, totalMinutes, videoPct,
} from "./store.js";
import {
  esc, icon, stageColor, fmtMin, videoMinutes, playVideo, resumeAt, fmtClock, tile, bindTiles, dropzone, bindDrop, slot, bindSlots, kindLabel,
} from "./ui.js";

const wkNum = (w) => `Week ${w.n}`;
const firstName = () => (state.settings.name || "").split(" ")[0];

function scheduleNote() {
  const start = new Date(state.settings.startDate + "T12:00:00");
  const days = Math.floor((Date.now() - start) / 864e5);
  if (isNaN(days) || days < 0) return "";
  const expected = Math.min(48, Math.floor(days / 7) + 1);
  const cur = currentWeek().n;
  const diff = cur - expected;
  if (diff >= 0) return `<span class="badge ok">On track</span>`;
  const behind = -diff;
  return behind <= 4
    ? `<span class="badge">${behind} week${behind > 1 ? "s" : ""} behind, within your 4 spare weeks</span>`
    : `<span class="badge accent">${behind} weeks behind schedule. That's fine, keep going.</span>`;
}

// ===================== WELCOME =====================
export function welcome(root, done) {
  root.innerHTML = `<div class="welcome"><div class="card stack">
    <div class="brand" style="padding:0"><div class="brand-mark">${icon("pencil")}</div>
      <div><div class="brand-name">${esc(course.cur.title)}</div><div class="brand-sub">${esc(course.cur.subtitle)}</div></div></div>
    <h1>Welcome! Let's set up your year.</h1>
    <p class="muted">48 weeks of drawing for animation, about 3 hours a day, 5 days a week. Everything you do here is saved on this computer.</p>
    <label class="field">Your name<input class="input" id="w-name" autocomplete="given-name"></label>
    <label class="field">Start date<input class="input" type="date" id="w-start" value="${today()}"></label>
    <label class="toggle"><input type="checkbox" id="w-anime" checked> Show the optional anime lessons</label>
    <button class="btn primary" id="w-go">Start the course</button>
  </div></div>`;
  root.querySelector("#w-go").onclick = () => {
    const name = root.querySelector("#w-name").value.trim();
    if (!name) return root.querySelector("#w-name").focus();
    state.settings.name = name;
    state.settings.startDate = root.querySelector("#w-start").value || today();
    state.settings.anime = root.querySelector("#w-anime").checked;
    save();
    done();
  };
}

// ===================== HOME =====================
export function home(root) {
  const w = currentWeek();
  const st = w.stage;
  const pct = weekPct(w);
  const tw = thisWeekStats();
  const streak = weekStreak();
  const ws = weekState(w.id);
  const nextStudy = w.study.find((_, i) => !ws.study[i]) || w.study[0];
  const recent = state.uploads.slice(-8).reverse();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  root.innerHTML = `
  <div class="stack" style="gap:24px">
    <div class="spread"><div><div class="eyebrow">${esc(st.months)} · ${esc(st.title)}</div><h1>${greet}, ${esc(firstName())}.</h1></div>${scheduleNote()}</div>

    <div class="card hero">
      <div class="hero-main">
        <div class="row"><span class="badge" style="background:${stageColor(st)};color:#fff">Stage ${st.n}</span><span class="faint small">${wkNum(w)} of 48</span>${w.benchmark ? '<span class="badge accent">Benchmark week</span>' : ""}</div>
        <h2 style="font-size:28px">${esc(w.title)}</h2>
        <p class="muted">${esc(w.goal)}</p>
        <div class="stack-s"><div class="progress"><span style="width:${pct}%"></span></div><div class="small faint">${pct}% of this week done · ${visibleVideos(w).length} videos · ${fmtMin(videoMinutes(w.videos.filter((v) => !v.optional && !v.anime)))} to watch</div></div>
        <div class="row"><a class="btn primary" href="#/week/${w.id}">${pct ? "Continue" : "Start"} ${wkNum(w).toLowerCase()} ${icon("right")}</a><a class="btn" href="#/practice">${icon("practice")} Start today's session</a></div>
      </div>
      <div class="hero-side">
        <div class="eyebrow">This week</div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="stat" style="padding:0"><div class="v">${tw.days}<span class="faint" style="font-size:18px">/${course.cur.daysPerWeek}</span></div><div class="l">days practised</div></div></div>
          <div><div class="stat" style="padding:0"><div class="v">${(tw.minutes / 60).toFixed(1)}<span class="faint" style="font-size:18px">/${course.cur.hoursPerDay * course.cur.daysPerWeek}h</span></div><div class="l">hours</div></div></div>
          <div><div class="stat" style="padding:0"><div class="v">${streak}</div><div class="l">week streak</div></div></div>
          <div><div class="stat" style="padding:0"><div class="v">${Math.round(totalMinutes() / 60)}</div><div class="l">hours in total</div></div></div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card pad stack">
        <div class="spread"><h2>Today's session</h2><span class="faint small">${course.cur.hoursPerDay} hours</span></div>
        <div class="blocklist">
          ${course.cur.dailyBlocks.map((b) => `<div class="block"><div class="min">${b.minutes} min</div><div class="what"><b>${esc(b.label)}</b>${esc(b.id === "study" ? nextStudy : st.daily[b.id])}</div></div>`).join("")}
        </div>
        <a class="btn" href="#/practice" style="align-self:flex-start">${icon("play")} Start the timer</a>
      </div>
      <div class="card pad stack">
        <div class="spread"><h2>Your year</h2><span class="faint small">${overallPct()}% complete</span></div>
        <div class="stage-strip">${course.cur.stages.map((s) => `<a href="#/course#${s.id}" title="${esc(s.title)}"><div class="bar"><span style="width:${stagePct(s)}%;background:${stageColor(s)}"></span></div><span>${s.n}</span></a>`).join("")}</div>
        <div class="stack-s">${course.cur.stages.map((s) => `<div class="small" style="display:grid;grid-template-columns:8px 92px 1fr;gap:8px;align-items:center"><span style="width:8px;height:8px;border-radius:50%;background:${stageColor(s)}"></span><b>${esc(s.months)}</b><span class="muted">${esc(s.title)}</span></div>`).join("")}</div>
      </div>
    </div>

    <div>
      <div class="spread" style="margin-bottom:12px"><h2>Recent drawings</h2><a class="btn small" href="#/gallery">Open gallery</a></div>
      ${recent.length ? `<div class="thumbs">${recent.map(tile).join("")}</div>` : `<div class="card empty">Your uploaded drawings will appear here. Take photos of your sketchbook pages and add them to each week's assignment.</div>`}
    </div>
  </div>`;
  bindTiles(root, () => home(root));
}

// ===================== COURSE =====================
export function courseView(root) {
  const cw = currentWeek();
  root.innerHTML = `
  <div class="stack" style="gap:20px">
    <div class="spread"><div><div class="eyebrow">Syllabus</div><h1>${esc(course.cur.subtitle)}</h1></div>
      <div class="ring" style="--p:${overallPct()};width:64px;height:64px" data-label="${overallPct()}%"></div></div>
    <p class="muted" style="max-width:720px">Six stages, eight weeks each. The last week of every stage is a review week with benchmark drawings. 48 weeks of lessons leaves about 4 spare weeks in the year for holidays and sick days.</p>
    ${course.cur.stages.map((st) => `
      <details class="card stage-card" id="${st.id}" ${st.weeks.includes(cw) || location.hash.endsWith("#" + st.id) ? "open" : ""}>
        <summary class="stage-head" style="list-style:none">
          <div class="rail" style="background:${stageColor(st)}"></div>
          <div class="stack-s">
            <div class="eyebrow">Stage ${st.n} · ${esc(st.months)}</div>
            <h2>${esc(st.title)}</h2>
            <p class="muted small">${esc(st.tagline)}</p>
          </div>
          <div class="ring" style="--p:${stagePct(st)};--c:${stageColor(st)}" data-label="${stagePct(st)}%"></div>
        </summary>
        <div class="week-list">
          ${st.weeks.map((w) => {
            const p = weekPct(w);
            return `<a class="week-row ${isDone(w) ? "done" : ""} ${w === cw ? "current" : ""}" href="#/week/${w.id}">
              <span class="num">${isDone(w) ? icon("check") : w.n}</span>
              <span><div class="t">${esc(w.title)}</div><div class="m">${visibleVideos(w).length} videos · ${w.study.length} exercises${w.benchmark ? " · benchmark" : ""}${w.videos.some((v) => v.anime) && state.settings.anime ? " · anime option" : ""}</div></span>
              <span class="small faint">${w === cw && !isDone(w) ? '<span class="badge accent">Current</span>' : p && !isDone(w) ? p + "%" : ""}</span>
            </a>`;
          }).join("")}
        </div>
      </details>`).join("")}
  </div>`;
}

// ===================== WEEK =====================
export function weekView(root, id) {
  const w = course.weekById[id];
  if (!w) return (root.innerHTML = `<div class="empty">That week doesn't exist. <a href="#/course">Back to the course</a></div>`);
  const st = w.stage;
  const ws = weekState(w.id);
  const idx = course.weeks.indexOf(w);
  const prev = course.weeks[idx - 1];
  const next = course.weeks[idx + 1];
  const vids = visibleVideos(w);
  const assignmentUps = uploadsFor({ week: w.id, kind: "assignment" });
  const rerender = () => weekView(root, id);
  const pct = weekPct(w);

  root.innerHTML = `
  <div class="crumbs"><a href="#/course">Course</a><span>›</span><a href="#/course#${st.id}">Stage ${st.n}: ${esc(st.title)}</a><span>›</span><span>${wkNum(w)}</span></div>
  <div class="week-head">
    <div class="stack-s">
      <div class="row"><span class="badge" style="background:${stageColor(st)};color:#fff">${wkNum(w)}</span>${w.benchmark ? '<span class="badge accent">Benchmark week</span>' : ""}${isDone(w) ? '<span class="badge ok">Completed</span>' : ""}</div>
      <h1>${esc(w.title)}</h1>
      <p class="muted" style="font-size:17px">${esc(w.goal)}</p>
    </div>
    <div class="stack-s" style="min-width:220px">
      <div class="progress ${pct === 100 ? "ok" : ""}"><span style="width:${pct}%"></span></div>
      <div class="small faint">${pct}% complete</div>
    </div>
  </div>

  <div class="section">
    <div class="spread" style="margin-bottom:14px"><h2>Watch</h2><span class="small faint">${fmtMin(videoMinutes(vids.filter((v) => !v.optional && !v.anime)))} required${vids.some((v) => v.optional || v.anime) ? " · " + fmtMin(videoMinutes(vids.filter((v) => v.optional || v.anime))) + " optional" : ""}</span></div>
    ${vids.length ? `<div class="grid grid-3">${vids.map((v) => {
      const meta = course.videos[v.id] || {};
      const watched = !!ws.videos[v.id];
      const vp = videoPct(v.id);
      const resume = resumeAt(v.id);
      return `<div class="card video-card">
        <button class="thumb ${watched ? "watched" : ""}" data-play="${esc(v.id)}" style="background-image:url('https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg')" aria-label="Play ${esc(meta.title)}">
          <span class="play"><span>${icon("play")}</span></span><span class="dur">${esc(meta.duration || "")}</span>${vp || watched ? `<span class="vprog"><span style="width:${watched ? 100 : vp}%"></span></span>` : ""}</button>
        <div class="video-body">
          <div class="row" style="gap:6px"><span class="small faint">${esc(meta.channel || "")}</span>${v.optional ? '<span class="badge">Optional</span>' : ""}${v.anime ? '<span class="badge anime">Anime</span>' : ""}</div>
          <div class="vt">${esc(meta.title || v.id)}</div>
          ${v.note ? `<div class="note">${esc(v.note)}</div>` : ""}
          ${vp && !watched ? `<div class="small" style="color:var(--accent);font-weight:600">${vp}% watched${resume ? " · resume at " + fmtClock(resume) : ""}</div>` : ""}
          <div class="video-foot">
            <label class="toggle small"><input type="checkbox" data-watch="${esc(v.id)}" ${watched ? "checked" : ""}> Watched</label>
            <a class="icon-btn" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" title="Open on YouTube">${icon("ext")}</a>
          </div>
        </div></div>`;
    }).join("")}</div>` : `<div class="card empty">No videos this week. It's all drawing.</div>`}
  </div>

  <div class="section">
    <h2>Main study</h2>
    <div class="card" style="padding:6px">
      ${w.study.map((s, i) => `<label class="check ${ws.study[i] ? "done" : ""}"><input type="checkbox" data-study="${i}" ${ws.study[i] ? "checked" : ""}><span>${esc(s)}</span></label>`).join("")}
    </div>
    ${w.worksheet ? `<div class="note-box" style="margin-top:12px">This week uses the <a href="#/worksheets">Master Study worksheet</a>. Fill one in before each study.</div>` : ""}
  </div>

  ${w.benchmark ? `<div class="section">
    <div class="spread" style="margin-bottom:6px"><h2>${esc(course.cur.benchmark.title)}</h2><a class="btn small" href="#/gallery/benchmarks">Compare all</a></div>
    <p class="muted" style="margin-bottom:14px">${esc(course.cur.benchmark.intro)}</p>
    <div class="grid grid-4">${course.cur.benchmark.items.map((b) => slot({ kind: "benchmark", slot: b.id, week: w.id }, b.label)).join("")}</div>
  </div>` : ""}

  <div class="section">
    <h2>Assignment</h2>
    <div class="card pad stack">
      <div><b>${esc(w.assignment.title)}</b><div class="muted">${esc(w.assignment.desc)}</div></div>
      ${assignmentUps.length ? `<div class="thumbs">${assignmentUps.map(tile).join("")}</div>` : ""}
      ${dropzone()}
    </div>
  </div>

  <div class="section">
    <h2>Your daily routine this stage</h2>
    <div class="card pad blocklist">
      ${course.cur.dailyBlocks.map((b) => `<div class="block"><div class="min">${b.minutes} min</div><div class="what"><b>${esc(b.label)}</b>${b.id === "study" ? "The exercises above. On day 1, start by watching this week's videos." : esc(st.daily[b.id])}</div></div>`).join("")}
    </div>
  </div>

  <div class="section focus-grid">
    <div class="card pad"><h3>Focus on</h3><ul>${st.focus.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
    <div class="card pad"><h3>Ignore for now</h3><ul>${st.ignore.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
  </div>

  <div class="section">
    <h2>Notes</h2>
    <textarea class="input" id="notes" placeholder="What clicked this week? What was hard? Questions to look up?">${esc(ws.notes)}</textarea>
  </div>

  <div class="section spread">
    <span class="muted small">${isDone(w) ? "Nice work. This week is done." : "Finished everything you want to? Mark the week complete to move on."}</span>
    <button class="btn ${isDone(w) ? "" : "primary"}" id="done">${isDone(w) ? "Mark as not complete" : icon("check") + " Complete " + wkNum(w).toLowerCase()}</button>
  </div>
  <div class="weeknav">
    ${prev ? `<a class="btn ghost" href="#/week/${prev.id}">${icon("left")} ${wkNum(prev)}: ${esc(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a class="btn ghost" href="#/week/${next.id}">${wkNum(next)}: ${esc(next.title)} ${icon("right")}</a>` : ""}
  </div>`;


  root.querySelectorAll("[data-play]").forEach((el) => {
    el.onclick = () => playVideo(el.dataset.play, () => {
      ws.videos[el.dataset.play] = true;
      save();
    }, rerender);
  });
  root.querySelectorAll("[data-watch]").forEach((el) => {
    el.onchange = () => {
      ws.videos[el.dataset.watch] = el.checked;
      save();
      rerender();
    };
  });
  root.querySelectorAll("[data-study]").forEach((el) => {
    el.onchange = () => {
      ws.study[el.dataset.study] = el.checked;
      save();
      rerender();
    };
  });
  root.querySelector("#notes").oninput = (e) => {
    ws.notes = e.target.value;
    save();
  };
  root.querySelector("#done").onclick = () => {
    ws.done = !ws.done;
    ws.doneAt = ws.done ? today() : null;
    save();
    if (ws.done && next) location.hash = "#/week/" + next.id;
    else rerender();
  };
  bindDrop(root.querySelector("[data-drop]"), { week: w.id, kind: "assignment" }, rerender);
  bindSlots(root, rerender);
  bindTiles(root, rerender);
}

// ===================== GALLERY =====================
let galleryFilter = "all";
export function gallery(root, tab = "all") {
  const rerender = () => gallery(root, tab);
  const tabs = `<div class="tabs">
    <a href="#/gallery" class="${tab === "all" ? "on" : ""}">All drawings</a>
    <a href="#/gallery/benchmarks" class="${tab === "benchmarks" ? "on" : ""}">Benchmark progress</a>
    <a href="#/gallery/starred" class="${tab === "starred" ? "on" : ""}">Starred</a></div>`;

  if (tab === "benchmarks") {
    const bweeks = course.weeks.filter((w) => w.benchmark);
    root.innerHTML = `<div class="stack"><h1>Gallery</h1>${tabs}
      <p class="muted">The same four drawings at the end of every stage. Read each row left to right to see your progress.</p>
      <div class="card pad compare"><table>
        <tr><th></th>${bweeks.map((w) => `<th>${wkNum(w)}<div class="faint small">${w.n === 1 ? "Baseline" : "Stage " + w.stage.n}</div></th>`).join("")}</tr>
        ${course.cur.benchmark.items.map((b) => `<tr><th style="vertical-align:middle">${esc(b.short)}</th>${bweeks.map((w) => {
          const u = uploadsFor({ week: w.id, kind: "benchmark", slot: b.id }).pop();
          return `<td>${u ? tile(u) : `<a class="none" href="#/week/${w.id}">Not yet</a>`}</td>`;
        }).join("")}</tr>`).join("")}
      </table></div></div>`;
    return bindTiles(root, rerender);
  }

  let ups = state.uploads.slice().reverse();
  if (tab === "starred") ups = ups.filter((u) => u.star);
  if (galleryFilter !== "all") ups = ups.filter((u) => course.weekById[u.week]?.stage.id === galleryFilter);
  const cw = currentWeek();
  root.innerHTML = `<div class="stack"><div class="spread"><h1>Gallery</h1><span class="faint">${state.uploads.length} drawings</span></div>${tabs}
    ${tab === "all" ? `<div class="card pad stack-s"><b>Add sketchbook pages</b><span class="small muted">Anything you drew outside the assignments: café sketches, gestures, doodles. They're filed under ${wkNum(cw)}.</span>${dropzone()}</div>` : `<p class="muted">Star your favourites from the lightbox. In week 47 you'll choose your 10 best for the portfolio.</p>`}
    <div class="chips"><button class="chip ${galleryFilter === "all" ? "on" : ""}" data-f="all">All stages</button>${course.cur.stages.map((s) => `<button class="chip ${galleryFilter === s.id ? "on" : ""}" data-f="${s.id}">Stage ${s.n}</button>`).join("")}</div>
    ${ups.length ? `<div class="thumbs" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${ups.map(tile).join("")}</div>` : `<div class="card empty">Nothing here yet.</div>`}
  </div>`;
  root.querySelectorAll("[data-f]").forEach((el) => (el.onclick = () => { galleryFilter = el.dataset.f; rerender(); }));
  bindDrop(root.querySelector("[data-drop]"), { week: cw.id, kind: "sketch" }, rerender);
  bindTiles(root, rerender);
}

// ===================== PORTFOLIO =====================
export function portfolio(root) {
  const p = course.cur.portfolio;
  const rerender = () => portfolio(root);
  const starred = state.uploads.filter((u) => u.star);
  const first = course.weeks[0];
  const last = course.weeks[course.weeks.length - 1];
  const doneCount = p.items.filter((it) => itemDone(it)).length;

  function itemDone(it) {
    if (it.text) return (state.portfolio.brief || "").trim().length > 40;
    if (it.starred) return starred.length >= 10;
    if (it.benchmarks) return uploadsFor({ week: last.id, kind: "benchmark" }).length > 0;
    return uploadsFor({ kind: "portfolio", slot: it.id }).length > 0;
  }

  root.innerHTML = `<div class="stack" style="gap:20px">
    <div class="spread"><div><div class="eyebrow">Final project · Weeks 41–48</div><h1>Portfolio</h1></div><span class="badge ${doneCount === p.items.length ? "ok" : ""}">${doneCount} of ${p.items.length} pieces</span></div>
    <p class="muted" style="max-width:720px">${esc(p.intro)}</p>
    ${p.items.map((it) => {
      const done = itemDone(it);
      let body = "";
      if (it.text) {
        body = `<textarea class="input" id="brief" placeholder="My character is… They live in… In my 20–30 second story moment, they…">${esc(state.portfolio.brief || "")}</textarea>`;
      } else if (it.starred) {
        body = starred.length ? `<div class="thumbs">${starred.map(tile).join("")}</div><div class="small faint">${starred.length} starred${starred.length < 10 ? `. Star ${10 - starred.length} more in the <a href="#/gallery">Gallery</a>` : ""}</div>` : `<div class="small muted">Star your best drawings in the <a href="#/gallery">Gallery</a>.</div>`;
      } else if (it.benchmarks) {
        body = `<div class="grid grid-4">${course.cur.benchmark.items.map((b) => {
          const a = uploadsFor({ week: first.id, kind: "benchmark", slot: b.id }).pop();
          const z = uploadsFor({ week: last.id, kind: "benchmark", slot: b.id }).pop();
          return `<div class="stack-s"><div class="small"><b>${esc(b.short)}</b></div><div class="thumbs" style="grid-template-columns:1fr 1fr">${a ? tile(a) : '<div class="tile"></div>'}${z ? tile(z) : '<div class="tile"></div>'}</div><div class="small faint">Week 1 → Week 48</div></div>`;
        }).join("")}</div>`;
      } else {
        const ups = uploadsFor({ kind: "portfolio", slot: it.id });
        body = `${ups.length ? `<div class="thumbs">${ups.map(tile).join("")}</div>` : ""}<div data-pdrop="${it.id}">${dropzone(ups.length ? "Add another version" : "Upload this piece")}</div>`;
      }
      return `<div class="card pad stack">
        <div class="spread"><div><div class="row" style="gap:8px"><h3>${esc(it.title)}</h3>${done ? '<span class="badge ok">Done</span>' : ""}</div><div class="muted small">${esc(it.desc)}</div></div>
        <a class="btn small" href="#/week/${it.week}">${wkNum(course.weekById[it.week])}</a></div>
        ${body}
      </div>`;
    }).join("")}
  </div>`;
  const brief = root.querySelector("#brief");
  if (brief) brief.oninput = () => { state.portfolio.brief = brief.value; save(); };
  root.querySelectorAll("[data-pdrop]").forEach((el) => {
    const it = p.items.find((x) => x.id === el.dataset.pdrop);
    bindDrop(el.querySelector("[data-drop]"), { kind: "portfolio", slot: it.id, week: it.week }, rerender);
  });
  bindTiles(root, rerender);
}

// ===================== WORKSHEETS =====================
export function worksheets(root, id) {
  const ws = course.cur.worksheet;
  if (id) return worksheetForm(root, id);
  const list = state.worksheets.slice().reverse();
  root.innerHTML = `<div class="stack" style="gap:20px">
    <div class="spread"><div><div class="eyebrow">Weeks 39–40 and any time after</div><h1>${esc(ws.title)}</h1></div><button class="btn primary" id="new">${icon("pencil")} New study</button></div>
    <p class="muted" style="max-width:720px">${esc(ws.intro)} Find stills from animated films on <a href="https://film-grab.com" target="_blank" rel="noopener">Film-Grab</a>.</p>
    ${list.length ? `<div class="grid grid-3">${list.map((s) => {
      const img = state.uploads.find((u) => u.kind === "worksheet" && u.slot === s.id);
      return `<a class="card video-card" href="#/worksheets/${s.id}" style="text-decoration:none">
        <div class="thumb" style="cursor:pointer;${img ? `background-image:url('${esc(img.url)}')` : ""}"></div>
        <div class="video-body"><div class="vt">${esc(s.fields.film || "Untitled study")}</div><div class="small faint">${esc(s.date)}${s.fields.focus ? " · " + esc(s.fields.focus) : ""}</div></div></a>`;
    }).join("")}</div>` : `<div class="card empty">No studies yet. Start one when you reach week 39, or any time you want to learn from a film you love.</div>`}
  </div>`;
  root.querySelector("#new").onclick = () => {
    const s = { id: uid(), date: today(), week: currentWeek().id, fields: {} };
    state.worksheets.push(s);
    save();
    location.hash = "#/worksheets/" + s.id;
  };
}
function worksheetForm(root, id) {
  const def = course.cur.worksheet;
  const s = state.worksheets.find((x) => x.id === id);
  if (!s) return (root.innerHTML = `<div class="empty">Study not found. <a href="#/worksheets">Back</a></div>`);
  const rerender = () => worksheetForm(root, id);
  const field = (f) => f.options
    ? `<label class="field">${esc(f.label)}<select class="input" data-k="${f.id}"><option value="">Choose…</option>${f.options.map((o) => `<option ${s.fields[f.id] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`
    : `<label class="field">${esc(f.label)}<textarea class="input" data-k="${f.id}" style="min-height:64px">${esc(s.fields[f.id] || "")}</textarea></label>`;
  const ups = state.uploads.filter((u) => u.kind === "worksheet" && u.slot === s.id);
  root.innerHTML = `<div class="crumbs"><a href="#/worksheets">Master studies</a><span>›</span><span>${esc(s.fields.film || "New study")}</span></div>
  <div class="stack" style="gap:20px">
    <h1>${esc(def.title)}</h1>
    <div class="card pad stack"><h2>Before you draw</h2>${def.before.map(field).join("")}</div>
    <div class="card pad stack"><h2>Your study</h2><p class="muted small">Upload your value thumbnail and the finished study.</p>${ups.length ? `<div class="thumbs">${ups.map(tile).join("")}</div>` : ""}${dropzone()}</div>
    <div class="card pad stack"><h2>After you draw</h2>${def.after.map(field).join("")}</div>
    <div class="spread"><a class="btn" href="#/worksheets">${icon("left")} All studies</a><button class="btn ghost small" id="del">${icon("trash")} Delete this study</button></div>
  </div>`;
  root.querySelectorAll("[data-k]").forEach((el) => {
    el.oninput = el.onchange = () => { s.fields[el.dataset.k] = el.value; save(); };
  });
  bindDrop(root.querySelector("[data-drop]"), { kind: "worksheet", slot: s.id, week: s.week }, rerender);
  bindTiles(root, rerender);
  const del = root.querySelector("#del");
  del.onclick = () => {
    if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Click again to delete"; return; }
    state.worksheets = state.worksheets.filter((x) => x.id !== id);
    save();
    location.hash = "#/worksheets";
  };
}

// ===================== RESOURCES =====================
export function resources(root) {
  root.innerHTML = `<div class="stack" style="gap:20px">
    <div><div class="eyebrow">Everything this course uses</div><h1>Resources</h1></div>
    <div class="grid grid-2">${course.cur.resources.map((r) => `<a class="card pad stack-s" href="${esc(r.url)}" target="_blank" rel="noopener" style="text-decoration:none">
      <div class="spread"><h3>${esc(r.name)}</h3>${icon("ext")}</div>
      <p class="muted small">${esc(r.what)}</p><span class="badge" style="align-self:flex-start">${esc(r.use)}</span></a>`).join("")}</div>
    <div class="card pad stack-s">
      <h3>The 12-month roadmap</h3>
      <p class="muted small">The structure of this course follows Mallery Jane's <i>12-Month Roadmap for Sketching &amp; Watercolor</i> (watercolor parts removed): see → value → (perspective instead of color) → composition → master studies → deepening. Each stage's "Focus on / Ignore for now" lists and the thumbnail and master-study exercises come from it.</p>
    </div>
    <div class="card pad stack-s">
      <h3>Supplies</h3>
      <p class="muted small">A few graphite pencils (HB, 2B, 4B), a kneaded eraser, a sharpener, a cheap A4 or A5 sketchbook for daily practice (you'll fill many), printer paper for drills, and a phone to photograph pages. For the flipbook in week 48: a pad of sticky notes.</p>
    </div>
  </div>`;
}

// ===================== SETTINGS =====================
export function settings(root, rerenderShell) {
  const s = state.settings;
  root.innerHTML = `<div class="stack" style="gap:20px;max-width:640px">
    <h1>Settings</h1>
    <div class="card pad stack">
      <label class="field">Name<input class="input" id="s-name" value="${esc(s.name)}"></label>
      <label class="field">Start date<span class="hint">Used to tell you whether you're on schedule.</span><input class="input" type="date" id="s-start" value="${esc(s.startDate)}"></label>
      <label class="toggle"><input type="checkbox" id="s-anime" ${s.anime ? "checked" : ""}> Show the optional anime lessons</label>
      <label class="field">Theme<select class="input" id="s-theme">${["auto", "light", "dark"].map((t) => `<option value="${t}" ${s.theme === t ? "selected" : ""}>${t === "auto" ? "System (match my computer)" : t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label>
    </div>
    <div class="card pad stack">
      <h2>Your data</h2>
      <p class="muted small">Progress is saved to <span class="kbd">data/progress.json</span> and drawings to <span class="kbd">data/uploads/</span> inside the app folder. A daily backup is kept in <span class="kbd">data/backups/</span>. To move to another computer, copy the whole <span class="kbd">data</span> folder.</p>
      <div class="row"><button class="btn" id="export">Download a backup of my progress</button>
      <label class="btn">Restore from a backup<input type="file" id="import" accept="application/json" hidden></label></div>
      <div class="small faint" id="import-msg"></div>
    </div>
  </div>`;
  const bind = (sel, key, ev = "input", get = (el) => el.value) => {
    root.querySelector(sel).addEventListener(ev, (e) => { s[key] = get(e.target); save(); rerenderShell?.(); });
  };
  bind("#s-name", "name");
  bind("#s-start", "startDate", "change");
  bind("#s-anime", "anime", "change", (el) => el.checked);
  bind("#s-theme", "theme", "change");
  root.querySelector("#export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: "application/json" }));
    a.download = `sketchbook-academy-progress-${today()}.json`;
    a.click();
  };
  root.querySelector("#import").onchange = async (e) => {
    const msg = root.querySelector("#import-msg");
    try {
      const obj = JSON.parse(await e.target.files[0].text());
      if (!obj || typeof obj !== "object" || !obj.settings) throw new Error("This doesn't look like a Sketchbook Academy backup.");
      const rev = state._rev; // a restore replaces the current copy, so it builds on the current revision
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, obj, { _rev: rev });
      await flush();
      msg.textContent = "Restored. Reloading…";
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      msg.textContent = err.message;
    }
  };
}

export { kindLabel };
