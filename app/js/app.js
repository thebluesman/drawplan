import { course, state, load, save } from "./store.js";
import { esc, icon, closeModal } from "./ui.js";
import { welcome, home, courseView, weekView, gallery, portfolio, worksheets, resources, settings } from "./views.js";
import { practice, timer, onTick, resetTimer, clock } from "./practice.js";

const NAV = [
  ["home", "Home", "#/"],
  ["course", "Course", "#/course"],
  ["practice", "Practice", "#/practice"],
  ["gallery", "Gallery", "#/gallery"],
  ["portfolio", "Portfolio", "#/portfolio"],
  ["worksheet", "Master studies", "#/worksheets"],
  ["resources", "Resources", "#/resources"],
  ["settings", "Settings", "#/settings"],
];

const THEMES = { auto: ["auto", "Auto"], light: ["sun", "Light"], dark: ["moon", "Dark"] };
const NEXT_THEME = { auto: "light", light: "dark", dark: "auto" };

function applyTheme() {
  const t = state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll("[data-theme-btn]").forEach((b) => {
    const [ic, label] = THEMES[t] || THEMES.auto;
    b.innerHTML = `${icon(ic)}<span>Theme: ${label}</span>`;
    b.title = `Theme: ${label} (click for ${THEMES[NEXT_THEME[t] || "light"][1]})`;
  });
  const sel = document.getElementById("s-theme");
  if (sel) sel.value = t;
}
function cycleTheme() {
  state.settings.theme = NEXT_THEME[state.settings.theme] || "light";
  save();
  applyTheme();
}

function shell() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/"><div class="brand-mark">${icon("pencil")}</div><div><div class="brand-name">${esc(course.cur.title)}</div><div class="brand-sub">Drawing for animation</div></div></a>
      <nav class="nav">${NAV.map(([k, label, href]) => `<a href="${href}" data-nav="${k}">${icon(k)}<span>${label}</span></a>`).join("")}</nav>
      <div id="timer-pill"></div>
      ${state.settings.demo ? '<div class="demo-flag">Demo data. Nothing here is real progress.</div>' : ""}
      <button class="theme-btn" data-theme-btn></button>
      <div class="sidebar-foot">${esc(state.settings.name ? state.settings.name + "'s sketchbook" : "")}</div>
    </aside>
    <div class="main">
      <div class="topbar"><button class="icon-btn" id="menu" aria-label="Menu">${icon("menu")}</button><b style="font-family:var(--font-display);flex:1">${esc(course.cur.title)}</b>${state.settings.demo ? '<span class="badge accent">Demo</span>' : ""}<button class="icon-btn" data-theme-btn data-compact aria-label="Change theme"></button></div>
      <main class="page" id="page"></main>
    </div>
  </div>`;
  document.getElementById("menu").onclick = () => document.getElementById("sidebar").classList.toggle("open");
  document.querySelectorAll("[data-theme-btn]").forEach((b) => (b.onclick = cycleTheme));
  applyTheme();
}

function updatePill() {
  const el = document.getElementById("timer-pill");
  if (!el) return;
  const onPractice = location.hash.startsWith("#/practice");
  el.innerHTML = timer.started && !onPractice
    ? `<a class="timer-pill" href="#/practice"><span>${timer.running ? "Practising" : "Paused"} · ${esc(course.cur.dailyBlocks[timer.block].label)}</span><span class="t">${clock(timer.remaining)}</span></a>`
    : "";
}

function route() {
  closeModal();
  document.getElementById("sidebar")?.classList.remove("open");
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("#")[0];
  const [, section = "", arg] = path.split("/");
  const page = document.getElementById("page");
  const key = section || "home";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === (key === "week" ? "course" : key === "worksheets" ? "worksheet" : key));
  });
  const titles = { home: "Home", course: "Course", week: "Week", practice: "Practice", gallery: "Gallery", portfolio: "Portfolio", worksheets: "Master studies", resources: "Resources", settings: "Settings" };
  document.title = `${titles[key] || "Home"} · ${course.cur.title}`;
  switch (key) {
    case "course": courseView(page); break;
    case "week": weekView(page, arg); break;
    case "practice": practice(page); break;
    case "gallery": gallery(page, arg || "all"); break;
    case "portfolio": portfolio(page); break;
    case "worksheets": worksheets(page, arg); break;
    case "resources": resources(page); break;
    case "settings": settings(page, () => { applyTheme(); }); break;
    default: home(page);
  }
  updatePill();
  const anchor = raw.split("#")[1];
  if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
}

async function boot() {
  const app = document.getElementById("app");
  try {
    await load();
  } catch (e) {
    app.innerHTML = `<div class="welcome"><div class="card stack"><h1>Can't reach the app server</h1>
      <p class="muted">Start the app with <b>start.command</b> (Mac) or <b>start.bat</b> (Windows), keep its window open, and reload this page.</p>
      <p class="small faint">${esc(e.message)}</p></div></div>`;
    return;
  }
  applyTheme();
  resetTimer();
  onTick(updatePill);
  const go = () => {
    shell();
    window.addEventListener("hashchange", route);
    route();
  };
  if (!state.settings.name) welcome(app, go);
  else go();
}
boot();
