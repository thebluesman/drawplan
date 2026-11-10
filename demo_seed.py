"""Generate demo data for trying out Sketchbook Academy.

Creates a learner who started 9 weeks ago and has finished Stage 1: practice
sessions, ticked-off weeks, notes, benchmark drawings, assignments, starred
sketches and one master-study worksheet. The "drawings" are generated placeholder
sketches (simple graphite-style shapes on paper), so no real images are needed.

Used by `python3 server.py --demo`. It only ever writes into the folder it's given.
"""

import json
import math
import os
import random
import struct
import zlib
from datetime import date, timedelta

PAPER = (246, 241, 231)
INK = (52, 48, 44)


# ---------------------------------------------------------------- tiny PNG "sketches"
class Canvas:
    def __init__(self, w, h, rnd, wob=0.0):
        self.w, self.h, self.rnd, self.wob = w, h, rnd, wob
        self.px = bytearray(bytes(PAPER) * (w * h))
        # faint paper grain
        for _ in range(w * h // 40):
            i = (rnd.randrange(h) * w + rnd.randrange(w)) * 3
            d = rnd.randint(4, 10)
            for k in range(3):
                self.px[i + k] = max(0, self.px[i + k] - d)

    def dot(self, x, y, r, alpha):
        x0, x1 = int(x - r), int(x + r) + 1
        y0, y1 = int(y - r), int(y + r) + 1
        for yy in range(max(0, y0), min(self.h, y1)):
            for xx in range(max(0, x0), min(self.w, x1)):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                    i = (yy * self.w + xx) * 3
                    for k in range(3):
                        self.px[i + k] = int(self.px[i + k] * (1 - alpha) + INK[k] * alpha)

    def stroke(self, pts, width=1.6, alpha=0.55):
        """Draw a wobbly pencil line through points."""
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(xb - xa, yb - ya) / 0.8))
            for s in range(n + 1):
                t = s / n
                self.dot(xa + (xb - xa) * t, ya + (yb - ya) * t, width / 2, alpha)

    def line(self, x0, y0, x1, y1, **kw):
        r = self.rnd
        k = 3 + self.wob * 3
        pts = [(x0, y0)]
        for t in (0.25, 0.5, 0.75):  # shaky beginners' lines bend more
            pts.append((x0 + (x1 - x0) * t + r.uniform(-k, k), y0 + (y1 - y0) * t + r.uniform(-k, k)))
        pts.append((x1, y1))
        self.stroke(pts, **kw)

    def ellipse(self, cx, cy, rx, ry, rot=0.0, **kw):
        r = self.rnd
        pts = []
        for i in range(49):
            a = i / 48 * 2 * math.pi * 1.04  # slight overshoot, like a real stroke
            x, y = rx * math.cos(a), ry * math.sin(a)
            x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
            n = 0.8 + self.wob * 0.9
            pts.append((cx + x + r.uniform(-n, n), cy + y + r.uniform(-n, n)))
        self.stroke(pts, **kw)

    def hatch(self, x0, y0, x1, y1, step=6, **kw):
        y = y0
        while y < y1:
            self.line(x0, y, x0 + (x1 - x0) * 0.9, y - (x1 - x0) * 0.25, width=1.0, alpha=0.3)
            y += step

    def png(self):
        raw = b"".join(b"\x00" + bytes(self.px[y * self.w * 3:(y + 1) * self.w * 3]) for y in range(self.h))

        def chunk(t, d):
            return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def sketch(kind, seed, skill=0.5):
    """skill 0..1 — later drawings are steadier."""
    rnd = random.Random(seed)
    wob = (1 - skill) * 6
    c = Canvas(360, 360, rnd, wob)
    j = lambda v: v + rnd.uniform(-wob, wob)

    if kind == "lines":
        for i in range(14):
            y = 30 + i * 22
            c.line(j(30), j(y), j(330), j(y + rnd.uniform(-6, 6)))
    elif kind == "ellipses":
        for row in range(3):
            for col in range(3):
                c.ellipse(70 + col * 110, 70 + row * 110, 42, 18 + row * 9, rot=rnd.uniform(-.4, .4))
    elif kind == "forms":
        c.ellipse(100, 110, 55, 55)  # sphere
        c.ellipse(100, 110, 55, 18)
        x, y, s = 200, 70, 80  # cube
        for a, b in [((x, y), (x + s, y)), ((x + s, y), (x + s, y + s)), ((x + s, y + s), (x, y + s)), ((x, y + s), (x, y)),
                     ((x, y), (x + 35, y - 25)), ((x + s, y), (x + s + 35, y - 25)), ((x + 35, y - 25), (x + s + 35, y - 25)),
                     ((x + s, y + s), (x + s + 35, y + s - 25)), ((x + s + 35, y - 25), (x + s + 35, y + s - 25))]:
            c.line(j(a[0]), j(a[1]), j(b[0]), j(b[1]))
        c.ellipse(120, 250, 45, 14)  # cylinder
        c.ellipse(120, 320, 45, 14)
        c.line(75, 250, 75, 320)
        c.line(165, 250, 165, 320)
        c.line(260, 210, 215, 320)  # cone
        c.line(260, 210, 305, 320)
        c.ellipse(260, 320, 45, 12)
        c.hatch(212, 160, 280, 300)
    elif kind == "figure":
        # line of action + bean + mannequin limbs
        c.stroke([(j(150), j(40)), (j(185), j(150)), (j(170), j(250)), (j(120), j(330))], width=2.2, alpha=.7)
        c.ellipse(j(160), j(55), 22, 26)
        c.ellipse(j(178), j(150), 34, 60, rot=.25)
        for a, b in [((185, 110), (250, 70)), ((250, 70), (300, 40)), ((170, 110), (110, 150)), ((110, 150), (80, 200)),
                     ((175, 205), (230, 260)), ((230, 260), (215, 335)), ((165, 210), (130, 270)), ((130, 270), (90, 320))]:
            c.line(j(a[0]), j(a[1]), j(b[0]), j(b[1]), width=2.0)
    elif kind == "room":
        hx, hy = 180, 150
        for p in [(20, 20), (340, 20), (20, 340), (340, 340)]:
            c.line(p[0], p[1], hx + (p[0] - hx) * .35, hy + (p[1] - hy) * .35, width=1.2)
        c.stroke([(117, 92), (243, 92), (243, 218), (117, 218), (117, 92)], width=1.4)
        c.stroke([(140, 120), (190, 120), (190, 175), (140, 175), (140, 120)], width=1.2)  # window
        c.line(20, hy, 340, hy, width=0.8, alpha=.3)
        c.stroke([(250, 300), (310, 270), (310, 230), (250, 260), (250, 300)])  # table-ish
    elif kind == "head":
        for k, cx in enumerate((70, 180, 290)):
            c.ellipse(j(cx), j(150), 42, 46)
            c.line(cx - 30, 150, cx + 30, 150, width=1, alpha=.35)
            c.line(cx + 8, 108, cx + 4, 196, width=1, alpha=.35)
            c.stroke([(cx - 28, 180), (cx - 10, 230), (cx + 10, 236), (cx + 32, 182)])
            c.dot(cx - 14, 150, 3, .8)
            c.dot(cx + 16, 150, 3, .8)
            mouth = [(cx - 12, 205), (cx, 205 + (8 if k == 0 else -6 if k == 1 else 0)), (cx + 12, 205)]
            c.stroke(mouth, width=1.6)
    elif kind == "animal":
        c.ellipse(j(130), j(170), 48, 40)  # ribcage
        c.ellipse(j(240), j(180), 36, 32)  # hips
        c.line(130, 130, 240, 150)
        c.line(130, 210, 240, 212)
        c.ellipse(j(70), j(110), 26, 22)  # head
        c.line(88, 125, 110, 140)
        for x in (115, 145, 230, 255):
            c.stroke([(x, 205), (x + rnd.uniform(-8, 8), 260), (x + rnd.uniform(-4, 4), 315)], width=1.8)
        c.stroke([(272, 170), (310, 140), (330, 150)])
    elif kind == "gesture":
        for i in range(6):
            ox, oy = 30 + (i % 3) * 110, 30 + (i // 3) * 165
            pts = [(ox + 40 + rnd.uniform(-15, 15), oy + 10)]
            for k in range(3):
                pts.append((ox + 40 + rnd.uniform(-30, 30), oy + 45 + k * 40))
            c.stroke(pts, width=2.0, alpha=.65)
            c.ellipse(pts[0][0], pts[0][1] + 6, 9, 11)
    return c.png()


# ---------------------------------------------------------------- demo learner
def build(data_dir, curriculum_path):
    cur = json.load(open(curriculum_path, encoding="utf-8"))
    weeks = [w for st in cur["stages"] for w in st["weeks"]]
    uploads_dir = os.path.join(data_dir, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    rnd = random.Random(42)
    today = date.today()
    start = today - timedelta(days=63)
    uploads = []
    n = [0]

    def add_img(kind, skill, week, utype, slot=None, star=False, caption="", day=None):
        n[0] += 1
        name = f"demo-{n[0]:03d}.png"
        with open(os.path.join(uploads_dir, name), "wb") as f:
            f.write(sketch(kind, n[0] * 7, skill))
        u = {"id": f"d{n[0]}", "file": name, "url": f"/uploads/{name}", "week": week, "kind": utype,
             "date": (day or today).isoformat(), "star": star, "caption": caption}
        if slot:
            u["slot"] = slot
        uploads.append(u)
        return u

    # Practice log: mostly 4-5 days a week, a couple of lighter weeks.
    sessions = []
    d = start
    while d <= today:
        wk = (d - start).days // 7
        if d.weekday() < 5 and rnd.random() < (0.55 if wk in (4, 7) else 0.9):
            sessions.append({"id": f"s{len(sessions)}", "date": d.isoformat(),
                             "minutes": rnd.choice([120, 150, 165, 180, 180, 180, 200]),
                             "week": weeks[min(wk, 8)]["id"],
                             "note": rnd.choice(["", "", "", "drew at the café", "hard day, kept going", "ellipses finally clicking"])})
        d += timedelta(days=1)

    # Weeks 1–8 done, week 9 half-done (current).
    wstate = {}
    notes = {
        "w01": "Baseline drawings are rough but that's the point.",
        "w03": "Ellipses are hard. Drawing from the shoulder helps.",
        "w06": "The 12 principles made gesture make so much more sense.",
        "w07": "Café sketching was scary at first. People move a lot!",
    }
    for i, w in enumerate(weeks[:9]):
        done = i < 8
        st = {
            "videos": {v["id"]: True for v in w["videos"] if done or not v.get("optional")} if done else
                      {v["id"]: True for v in w["videos"][:2]},
            "study": {str(k): True for k in range(len(w["study"]))} if done else {"0": True},
            "done": done,
            "notes": notes.get(w["id"], ""),
        }
        if done:
            st["doneAt"] = (start + timedelta(days=7 * i + 6)).isoformat()
        wstate[w["id"]] = st

    # Benchmarks: baseline (week 1) and end of stage 1 (week 8), visibly better.
    for wid, skill, offset in (("w01", 0.05, 0), ("w08", 0.6, 53)):
        for b in cur["benchmark"]["items"]:
            add_img(b["id"], skill, wid, "benchmark", slot=b["id"], day=start + timedelta(days=offset))

    # Assignments for weeks 1–8 (+ one for week 9).
    kinds = {"w01": "lines", "w02": "ellipses", "w03": "forms", "w04": "forms", "w05": "forms",
             "w06": "gesture", "w07": "gesture", "w09": "forms"}
    for i, w in enumerate(weeks[:9]):
        if w["id"] in kinds:
            add_img(kinds[w["id"]], 0.1 + i * 0.07, w["id"], "assignment",
                    star=w["id"] in ("w03", "w06"), day=start + timedelta(days=7 * i + 4))

    # A few sketchbook pages.
    for i, (k, wid) in enumerate([("gesture", "w05"), ("figure", "w07"), ("animal", "w08"), ("room", "w08"), ("head", "w09")]):
        add_img(k, 0.3 + i * 0.08, wid, "sketch", star=i in (1, 2), caption="Sketchbook page", day=today - timedelta(days=20 - i * 4))

    # Video watch tracking: week 9's first two videos finished, the third half-watched.
    vids = json.load(open(os.path.join(os.path.dirname(curriculum_path), "videos.json"), encoding="utf-8"))

    def secs(d):
        out = 0
        for part in d.split(":"):
            out = out * 60 + int(part)
        return out

    video_track = {}
    w9 = weeks[8]["videos"]
    for k, v in enumerate(w9[:3]):
        dur = secs(vids[v["id"]]["duration"])
        chunks = -(-dur // 10)
        upto = chunks if k < 2 else chunks * 45 // 100
        video_track[v["id"]] = {"pos": dur if k < 2 else upto * 10, "dur": dur, "seen": "1" * upto + "0" * (chunks - upto)}
    wstate["w09"]["videos"] = {v["id"]: True for v in w9[:2]}

    progress = {
        "v": 1,
        "settings": {"name": "Demo Learner", "startDate": start.isoformat(), "anime": True, "theme": "auto", "demo": True},
        "weeks": wstate,
        "sessions": sessions,
        "uploads": uploads,
        "portfolio": {},
        "videos": video_track,
        "worksheets": [{
            "id": "ws1", "date": today.isoformat(), "week": "w09",
            "fields": {"film": "A quiet kitchen scene from a hand-drawn film", "focus": "Value structure",
                       "key": "Mid key, with one bright window", "eye": "The window. It's the lightest value and the only hard edge"},
        }],
    }
    with open(os.path.join(data_dir, "progress.json"), "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=1)
    return len(uploads)


if __name__ == "__main__":
    import sys
    root = os.path.dirname(os.path.abspath(__file__))
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "demo-data")
    count = build(target, os.path.join(root, "app", "data", "curriculum.json"))
    print(f"Demo data written to {target} ({count} drawings)")
