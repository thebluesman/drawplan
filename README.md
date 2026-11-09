# Sketchbook Academy

A 48-week pencil drawing course for someone heading towards animation. It runs locally in the browser, like a small Skillshare or Coursera with one student.

- **Course:** 6 stages × 8 weeks. Each week has embedded videos, main-study exercises, an assignment upload, notes, and the stage's "focus on / ignore" lists.
- **Practice:** a 3-hour session timer (warm-up → gesture → main study → sketchbook), a manual practice log, and a 26-week activity heatmap.
- **Busy days:** the timer also offers a 1-hour short session and a 20-minute "just a sketch". Home has a "Take today off" button, and rest days show as rings on the heatmap. Weeks unlock when you finish them, not by date, so a missed day only moves things along by a day. The session lengths are set in `sessionPlans` in `curriculum.json`.
- **Onboarding:** four short steps on first run (name, how the year works, a day of drawing, start date). You can replay it from Settings.
- **Gallery:** every uploaded drawing, plus a benchmark comparison grid (the same 4 drawings at the end of each stage).
- **Portfolio:** the final project in weeks 41–48 (turnaround, expressions, poses, environments, storyboard, flipbook).
- **Master studies:** the roadmap's worksheet, used with film stills.

## Getting it

Go to <https://github.com/thebluesman/drawplan>, click the green **Code** button, then **Download ZIP**. Unzip it somewhere you'll keep it, like your Documents folder.

## Running it

You need Python 3.8 or newer. There's nothing else to install.

- **Mac:** double-click `start.command`. If macOS blocks it the first time, right-click → Open. Or run `python3 server.py` in Terminal.
- **Windows:** double-click `start.bat`.

The browser opens at <http://127.0.0.1:4817>. Keep the terminal window open while using the app, and close it to stop.

The app only listens on this computer (`127.0.0.1`). Videos play from YouTube, so you need to be online for those.

## Updating

In the app, go to **Settings → Check for updates**. If there's a new version, click **Update now**. The app downloads it from GitHub, restarts itself and reloads the page. Your progress and drawings in `data/` are left alone. On Windows, close the app's window and start it again when it asks.

If the app won't start, double-click `update.command` (Mac) or `update.bat` (Windows) instead. It does the same thing. If macOS blocks it the first time, right-click → Open.

The installed version is recorded in `.version`. If the folder is a git clone, the updater runs `git pull` instead.

## Trying it with demo data

```
python3 server.py --demo          # or double-click start-demo.command
python3 server.py --demo --reset-demo   # start the demo over from scratch
```

Demo mode runs at <http://127.0.0.1:4818> with a sample learner who started 9 weeks ago and has finished Stage 1. It includes a practice history, ticked-off weeks, notes, placeholder drawings (generated shapes, so the gallery has something to show), benchmark comparisons and a master-study worksheet. Everything lives in `demo-data/`, separate from the real `data/` folder, so you can click around freely. A "Demo data" banner shows in the sidebar. Delete `demo-data/` once you're done with it.

## Where things are saved

```
data/progress.json   all progress, notes, practice log, worksheets
data/uploads/        photos of drawings
data/backups/        one copy of progress.json per day (last 30 days)
data/trash/          deleted drawings, in case of accidents
```

To back up or move to another computer, copy the `data/` folder. Settings → "Download a backup" exports progress only (no images).

## Editing the course

All the content lives in two files, so the course can change without touching code:

- `app/data/curriculum.json` holds the stages, weeks, exercises, videos per week, portfolio items, worksheet and resources. Videos are referenced by YouTube ID. Add `"optional": true` or `"anime": true` to mark a video optional or part of the anime track.
- `app/data/videos.json` holds the title, channel and duration for each video ID. A new video added to the curriculum needs an entry here too.

Reload the browser after editing. Progress is keyed by week ID (`w01` … `w48`) and video ID, so editing text is safe. Renaming a week ID loses that week's checkmarks.

## Design and icons

The look follows the Oura design system in `DESIGN.md`, installed with `npx getdesign@0.6.26 add oura`. Its rules: a warm-paper canvas, white soft-cornered cards on hairlines, pill buttons, one action blue kept for the primary action on each screen, earth tones (clay, gold, olive) for data and highlights, and a near-black band for the weekly stats and the practice timer. The one deliberate change is the typeface: Apfel Grotezk replaces both of Oura's fonts.

- All styling is in `app/css/styles.css`. The colour variables at the top cover both light and dark themes.
- The typeface is Apfel Grotezk by Collletttivo, served from `app/fonts/` under the SIL Open Font License.
- Icons are [Phosphor](https://phosphoricons.com) (MIT), stored in `app/icons/` and bundled into `app/js/icons.js`. To add one, save its SVG (regular weight, or the `-fill` version) into `app/icons/` and run `python3 tools/build_icons.py`. Use it in code as `icon("name")`.

Everything works offline except the YouTube videos.

## Saving safely

Each save carries a revision number. If the app is open in two tabs, or an old tab is left open, the out-of-date tab can't overwrite newer progress. Its save is refused, and it reloads the latest progress. The one change made in the stale tab is lost.

## Sources

The structure follows Mallery Jane's *12-Month Roadmap* (with the watercolor removed). Videos come from Peter Han's *Dynamic Sketching* (a third-party re-upload, so links may change), Draw like a Sir, Proko, Aaron Blaise and Alan Becker. Daily gesture practice uses Line of Action, and film studies use Film-Grab.
