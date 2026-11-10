// Small DOM helpers, icons, modals and the upload widget.
import { course, state, save, upload, removeUpload, videoTrack, videoPct, trackVideo } from "./store.js";
import { ICONS } from "./icons.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Phosphor icons (regular weight; "-fill" variants where noted). Short names used around the app → Phosphor names.
const ALIAS = {
  home: "house", course: "book-open-text", practice: "timer", gallery: "images", portfolio: "briefcase",
  worksheet: "notebook", resources: "link-simple", settings: "gear-six", play: "play-fill", pause: "pause-fill",
  next: "skip-forward", ext: "arrow-square-out", upload: "upload-simple", menu: "list", pencil: "pencil-simple-line",
  left: "caret-left", right: "caret-right", auto: "circle-half", done: "check-circle-fill", benchmark: "flag-pennant-fill",
  video: "film-strip", streak: "fire", focus: "target", ignore: "prohibit", image: "image-square",
};
export const icon = (n) =>
  `<svg class="ph" width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${ICONS[ALIAS[n] || n] || ""}</svg>`;

export const stageColor = (st) => `var(--s${st.n})`;
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m}m`);
export function durSecs(d) {
  return String(d || "0").split(":").reduce((a, x) => a * 60 + Number(x), 0);
}
export function videoMinutes(list) {
  return Math.round(list.reduce((a, v) => a + durSecs(course.videos[v.id]?.duration), 0) / 60);
}

// ---------- modals ----------
export function openModal(inner, cls = "") {
  closeModal();
  const m = document.createElement("div");
  m.className = "modal " + cls;
  m.id = "modal";
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${inner}</div>`;
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(m);
  document.body.style.overflow = "hidden";
  m.querySelector("[data-close]")?.focus();
  return m;
}
export function closeModal() {
  const hook = closeHook;
  closeHook = null;
  hook?.();
  document.getElementById("modal")?.remove();
  document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ---------- YouTube player with watch tracking ----------
let ytReady = null;
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { ytReady = null; reject(new Error("YouTube API unavailable")); };
      document.head.appendChild(s);
      setTimeout(() => reject(new Error("YouTube API timed out")), 8000);
    });
  }
  return ytReady;
}
export const fmtClock = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
};
/** Where to resume from, or 0 to start at the beginning. */
export function resumeAt(id) {
  const t = videoTrack(id);
  return t && t.pos > 15 && (!t.dur || t.pos < t.dur - 30) ? t.pos : 0;
}

let closeHook = null;
/**
 * Play a video in a modal. Tracks which parts get watched, resumes where you left off,
 * and calls onWatched() once 90% has been watched (or the button is pressed).
 * onClose() runs when the modal closes, so the page can refresh its progress bars.
 */
export function playVideo(id, onWatched, onClose) {
  const v = course.videos[id] || { title: "Video" };
  const start = resumeAt(id);
  const m = openModal(`
    <div class="video"><div id="yt-player"></div></div>
    <div class="modal-bar">
      <div style="flex:1;min-width:220px"><div style="font-weight:600">${esc(v.title)}</div>
        <div class="small faint"><span>${esc(v.channel || "")} · ${esc(v.duration || "")}</span> · <span data-vstat>${videoPct(id)}% watched</span></div>
        <div class="progress" style="margin-top:6px;height:5px"><span data-vbar style="width:${videoPct(id)}%"></span></div></div>
      <div class="row">
        <a class="btn small" href="https://www.youtube.com/watch?v=${esc(id)}${start ? "&t=" + start + "s" : ""}" target="_blank" rel="noopener">${icon("ext")} Open on YouTube</a>
        <button class="btn small primary" data-watched>${icon("check")} Mark watched</button>
        <button class="icon-btn" data-close aria-label="Close">${icon("x")}</button>
      </div>
    </div>`);
  let player = null, timer = null, notified = false, lastSave = Date.now();
  const stat = m.querySelector("[data-vstat]"), bar = m.querySelector("[data-vbar]");
  const markWatched = () => { if (!notified) { notified = true; onWatched?.(); } };

  const sample = (forceSave = false) => {
    if (!player?.getCurrentTime) return;
    const playing = player.getPlayerState?.() === 1;
    const fresh = trackVideo(id, player.getCurrentTime(), player.getDuration(), playing);
    const pct = videoPct(id);
    stat.textContent = `${pct}% watched`;
    bar.style.width = pct + "%";
    if (pct >= 90) markWatched();
    if (forceSave || (fresh && Date.now() - lastSave > 15000)) { lastSave = Date.now(); save(); }
  };

  closeHook = () => {
    clearInterval(timer);
    sample(true);
    try { player?.destroy(); } catch {}
    onClose?.();
  };

  loadYouTubeAPI().then((YT) => {
    if (!document.getElementById("yt-player")) return; // closed before the API loaded
    player = new YT.Player("yt-player", {
      host: "https://www.youtube-nocookie.com",
      videoId: id,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1, start: Math.floor(start), origin: location.origin },
      events: {
        onReady: () => { timer = setInterval(() => sample(), 1000); },
        onStateChange: (e) => { if (e.data === 2 || e.data === 0) sample(true); }, // paused or ended
      },
    });
  }).catch(() => {
    // No API (offline or blocked): plain embed, no tracking.
    const box = document.getElementById("yt-player");
    if (box) box.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&rel=0&start=${Math.floor(start)}"
      title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    stat.textContent = "progress tracking unavailable";
  });

  m.querySelector("[data-watched]").onclick = () => { markWatched(); closeModal(); };
}

export function lightbox(u, rerender) {
  const m = openModal(
    `<img src="${esc(u.url)}" alt="${esc(u.caption || "Drawing")}">
    <div class="modal-bar">
      <div class="stack-s" style="flex:1;min-width:200px">
        <input class="input" data-cap placeholder="Add a caption…" value="${esc(u.caption)}">
        <div class="small faint">${esc(u.date)}${u.week ? " · Week " + Number(u.week.slice(1)) : ""} · ${esc(kindLabel(u))}</div>
      </div>
      <div class="row">
        <button class="btn small" data-star>${icon("star")} ${u.star ? "Starred" : "Star"}</button>
        <button class="btn small" data-del>${icon("trash")} Delete</button>
        <button class="icon-btn" data-close aria-label="Close">${icon("x")}</button>
      </div>
    </div>`,
    "lightbox"
  );
  m.querySelector("[data-cap]").oninput = (e) => {
    u.caption = e.target.value;
    save();
  };
  m.querySelector("[data-star]").onclick = () => {
    u.star = !u.star;
    save();
    closeModal();
    rerender?.();
  };
  const del = m.querySelector("[data-del]");
  del.onclick = async () => {
    if (del.dataset.confirm !== "1") {
      del.dataset.confirm = "1";
      del.innerHTML = `${icon("trash")} ${matchMedia("(hover: none)").matches ? "Tap" : "Click"} again to delete`;
      return;
    }
    await removeUpload(u.id);
    closeModal();
    rerender?.();
  };
}

export function kindLabel(u) {
  if (u.kind === "benchmark") return "Benchmark · " + (course.cur.benchmark.items.find((b) => b.id === u.slot)?.short || u.slot);
  if (u.kind === "portfolio") return "Portfolio · " + (course.cur.portfolio.items.find((p) => p.id === u.slot)?.title || u.slot);
  if (u.kind === "assignment") return "Assignment";
  if (u.kind === "worksheet") return "Master study";
  return "Sketchbook";
}

const shortDate = (d) => (d ? new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const tileCap = (u) => [u.caption, shortDate(u.date)].filter(Boolean).join(" · ");

export const tile = (u) =>
  `<button class="tile" data-tile="${esc(u.id)}"><img loading="lazy" src="${esc(u.url)}" alt="${esc(u.caption || "Drawing")}">${u.star ? `<span class="star" aria-label="Starred">${icon("star-fill")}</span>` : ""}${tileCap(u) ? `<span class="cap">${esc(tileCap(u))}</span>` : ""}</button>`;

export function bindTiles(root, rerender) {
  root.querySelectorAll("[data-tile]").forEach((el) => {
    el.onclick = () => {
      const u = state.uploads.find((x) => x.id === el.dataset.tile);
      if (u) lightbox(u, rerender);
    };
  });
}

/** A drop zone / file picker. `meta` is merged into every upload record. */
const DROP_LABEL = matchMedia("(hover: none)").matches
  ? "Take a photo of your drawing, or choose one" // phones and tablets: the picker offers the camera
  : "Drop photos of your drawings here, or click to choose";
export function dropzone(label = DROP_LABEL, multiple = true) {
  return `<label class="dropzone" data-drop>
    <input type="file" accept="image/*" ${multiple ? "multiple" : ""}>
    <div class="row" style="justify-content:center">${icon("upload")} <span>${esc(label)}</span></div>
    <div class="small faint" data-drop-status></div>
  </label>`;
}
export function bindDrop(el, meta, after) {
  if (!el) return;
  const input = el.querySelector("input");
  const status = el.querySelector("[data-drop-status]");
  const run = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/") || /\.heic$/i.test(f.name));
    if (!list.length) return;
    for (let i = 0; i < list.length; i++) {
      status.textContent = `Uploading ${i + 1} of ${list.length}…`;
      try {
        await upload(list[i], typeof meta === "function" ? meta(i) : meta);
      } catch (e) {
        status.textContent = "Upload failed: " + e.message;
        return;
      }
    }
    status.textContent = "";
    after?.();
  };
  input.onchange = () => run(input.files);
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.classList.add("over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("over");
    run(e.dataTransfer.files);
  });
}

/** A single image slot (benchmark item, portfolio item). */
export function slot(meta, label) {
  const ups = state.uploads.filter((u) => u.kind === meta.kind && u.slot === meta.slot && (!meta.week || u.week === meta.week));
  const last = ups[ups.length - 1];
  return `<div class="slot">
    ${last ? tile(last) : `<label class="slot-empty" data-slot='${esc(JSON.stringify(meta))}'><input type="file" accept="image/*" hidden><span>${icon("upload")}<br>Upload</span></label>`}
    <div class="small">${esc(label)}</div>
  </div>`;
}
export function bindSlots(root, after) {
  root.querySelectorAll("[data-slot]").forEach((el) => {
    const meta = JSON.parse(el.dataset.slot);
    const input = el.querySelector("input");
    input.onchange = async () => {
      if (!input.files[0]) return;
      el.querySelector("span").textContent = "Uploading…";
      try {
        await upload(input.files[0], meta);
      } catch (e) {
        el.querySelector("span").textContent = e.message;
        return;
      }
      after?.();
    };
  });
}
