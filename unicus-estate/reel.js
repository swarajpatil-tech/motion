/* =========================================================================
   UNICUS ESTATE — MOTION PIECE
   A 30 second vertical reel, drawn onto a 1080x1920 canvas.
   Every scene is a pure function of time, so the whole thing can be
   scrubbed, stepped frame by frame, screenshotted or recorded to video.
   ========================================================================= */

const W = 1080, H = 1920, FPS = 30, DURATION = 30;

const P = {
  ink:      '#0A100D',
  ink2:     '#0F1A15',
  ink3:     '#16241D',
  paper:    '#F4F1E9',
  paper2:   '#E8E3D7',
  brass:    '#C39A5C',
  brassSoft:'#D8BC8E',
  sage:     '#9FB0A4',
  moss:     '#3C4F43',
  wa:       '#D9FDD3',
  waInk:    '#0B141A',
  tick:     '#53BDEB',
  alert:    '#B4553F'
};

/* ---------- maths ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
// progress of t through the window [a,b], clamped 0..1
const seg   = (t, a, b) => clamp((t - a) / (b - a));

const ease = {
  out:      t => 1 - Math.pow(1 - t, 3),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo:  t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOut:    t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuint: t => (t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2)
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- canvas + assets ---------- */
const canvas = document.getElementById('stage');
const c = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

const IMAGE_FILES = {
  hero: 'assets/hero.jpg',
  ridge: 'assets/ridge.jpg',
  valley: 'assets/valley.jpg'
};
const IMG = {};

function loadImages() {
  return Promise.all(Object.entries(IMAGE_FILES).map(([k, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => res();
    im.src = src;
  })));
}

/* ---------- reusable textures ---------- */
// film grain, so the flat vector graphics don't look sterile
const grainCanvas = document.createElement('canvas');
grainCanvas.width = grainCanvas.height = 220;
(function makeGrain() {
  const g = grainCanvas.getContext('2d');
  const d = g.createImageData(220, 220);
  const rnd = mulberry32(7);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 140 + rnd() * 115;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 26 + rnd() * 40;
  }
  g.putImageData(d, 0, 0);
})();

function drawGrain(ctx, frame) {
  const rnd = mulberry32(1000 + frame);
  const ox = -rnd() * 220, oy = -rnd() * 220;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'overlay';
  for (let y = oy; y < H; y += 220) for (let x = ox; x < W; x += 220) ctx.drawImage(grainCanvas, x, y);
  ctx.restore();
}

function drawVignette(ctx, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H * 0.46, W * 0.18, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- type helpers ---------- */
// letter-spaced text, drawn glyph by glyph so tracking is exact
function tracked(ctx, text, x, y, track, align = 'left') {
  const chars = [...text];
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + track; });
  return total;
}

function fitFont(ctx, text, size, maxW, weight = 300, family = 'Fraunces, serif') {
  let sz = size;
  while (sz > 40) {
    ctx.font = `${weight} ${sz}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    sz -= 4;
  }
  return sz;
}

function textWidthTracked(ctx, text, track) {
  const chars = [...text];
  return chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + track * (chars.length - 1);
}

// text rising up out of a mask + fading in — the workhorse reveal
function rise(ctx, p, x, yTop, w, h, drawFn) {
  if (p <= 0) return;
  const e = ease.outQuint(p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 60, yTop - 20, w + 120, h + 40);
  ctx.clip();
  ctx.translate(0, (1 - e) * h * 1.25);
  ctx.globalAlpha *= clamp(e * 1.6);
  drawFn();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// image fitted to a box, object-fit: cover
function drawCover(ctx, img, x, y, w, h, zoom = 1, panX = .5, panY = .5) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) * panX, y + (h - dh) * panY, dw, dh);
}

/* ---------- masterplan geometry (built once, deterministic) ---------- */
const PLOTS = (() => {
  const rnd = mulberry32(20261113);
  const plots = [];
  const cols = 4, rows = 5;
  const x0 = 128, x1 = 952, y0 = 700, y1 = 1400;
  const cw = (x1 - x0) / cols, chh = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const cx = x0 + cw * (col + .5);
      const cy = y0 + chh * (r + .5);
      const w = cw * .74, h = chh * .68;
      const j = () => (rnd() - .5) * 12;
      const pts = [
        [-w / 2 + j(), -h / 2 + j()],
        [ w / 2 + j(), -h / 2 + j()],
        [ w / 2 + j(),  h / 2 + j()],
        [-w / 2 + j(),  h / 2 + j()]
      ];
      plots.push({ cx, cy, pts, i: plots.length });
    }
  }
  return plots;
})();

// contour lines behind the map
const CONTOURS = (() => {
  const rnd = mulberry32(99);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const yBase = 620 + i * 118 + rnd() * 20;
    out.push([
      [-40, yBase + rnd() * 30],
      [W * .28, yBase - 40 + rnd() * 40],
      [W * .62, yBase + 46 + rnd() * 40],
      [W + 40, yBase - 26 + rnd() * 30]
    ]);
  }
  return out;
})();

/* =========================================================================
   SCENE 1 — 0.0 → 3.0   the mark draws itself
   ========================================================================= */
function sceneLockup(ctx, t) {
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 880, 0, W / 2, 880, 900);
  glow.addColorStop(0, 'rgba(195,154,92,.11)');
  glow.addColorStop(1, 'rgba(195,154,92,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // triangle mark, stroked on
  const p = ease.outQuint(seg(t, 0.15, 1.35));
  ctx.save();
  ctx.translate(W / 2, 810);
  const sc = lerp(0.9, 1, ease.outQuint(seg(t, 0.1, 1.6)));
  ctx.scale(sc, sc);
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -74); ctx.lineTo(62, 32); ctx.lineTo(-62, 32); ctx.closePath();
  const L = 400;
  ctx.setLineDash([L, L]);
  ctx.lineDashOffset = L * (1 - p);
  ctx.stroke();
  ctx.restore();

  // wordmark, tracking settles inwards
  const wp = ease.outQuint(seg(t, 0.55, 1.65));
  ctx.save();
  ctx.fillStyle = P.paper;
  ctx.font = '300 82px Fraunces, serif';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha *= clamp(wp * 1.4);
  tracked(ctx, 'UNICUS', W / 2, 1010, lerp(44, 26, wp), 'center');
  ctx.restore();

  // hairline
  const lp = ease.outQuint(seg(t, 0.95, 1.9));
  ctx.save();
  ctx.strokeStyle = `rgba(195,154,92,${0.85 * clamp(lp * 1.4)})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 150 * lp, 1058);
  ctx.lineTo(W / 2 + 150 * lp, 1058);
  ctx.stroke();
  ctx.restore();

  // sub line
  const sp = ease.outQuint(seg(t, 1.15, 2.05));
  if (sp > 0) {
    ctx.save();
    ctx.fillStyle = P.paper;
    ctx.font = '500 23px Inter, sans-serif';
    ctx.globalAlpha *= clamp(sp * 1.4);
    tracked(ctx, 'REAL ESTATE  ·  IGATPURI', W / 2, 1112, 12, 'center');
    ctx.restore();
  }
}

/* =========================================================================
   SCENE 2 — 3.0 → 7.4   the broken link (the problem)
   ========================================================================= */
const URL_TEXT = 'unicusrealestate.com';

function sceneDeadLink(ctx, t) {
  ctx.fillStyle = P.ink2;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, 820);
  glow.addColorStop(0, 'rgba(159,176,164,.09)');
  glow.addColorStop(1, 'rgba(159,176,164,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const inP = ease.outQuint(seg(t, 0, .6));
  const bx = 84, by = 650, bw = W - 168, bh = 500;

  ctx.save();
  ctx.globalAlpha *= inP;
  ctx.translate(0, (1 - inP) * 44);

  // window shell — a light card, so it reads instantly against the dark frame
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.fillStyle = P.paper;
  ctx.fill();
  ctx.restore();

  // chrome bar
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.clip();
  ctx.fillStyle = P.paper2;
  ctx.fillRect(bx, by, bw, 96);
  ctx.fillStyle = 'rgba(10,16,13,.08)';
  ctx.fillRect(bx, by + 96, bw, 1.4);
  ctx.restore();

  ['#C97B6B', '#D9B36A', '#8FAE7E'].forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(bx + 44 + i * 28, by + 48, 7, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });

  // address pill
  const px = bx + 160, py = by + 26, pw = bw - 200, ph = 44;
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,16,13,.14)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // padlock
  ctx.save();
  ctx.strokeStyle = 'rgba(10,16,13,.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 24, py + 19, 10, 8);
  ctx.beginPath(); ctx.arc(px + 29, py + 19, 4.4, Math.PI, 0); ctx.stroke();
  ctx.restore();

  // typed url
  const chars = Math.floor(URL_TEXT.length * seg(t, .55, 1.45));
  if (chars > 0) {
    ctx.save();
    ctx.fillStyle = P.ink;
    ctx.font = '400 27px Inter, sans-serif';
    const shown = URL_TEXT.slice(0, chars);
    ctx.fillText(shown, px + 52, py + 30);
    if (chars < URL_TEXT.length && Math.floor(t * 3) % 2 === 0) {
      const w = ctx.measureText(shown).width;
      ctx.fillRect(px + 56 + w, py + 11, 2, 22);
    }
    ctx.restore();
  }

  // loading bar, stalls, then fails
  const loadP = seg(t, 1.45, 1.85);
  const failed = t > 1.85;
  if (loadP > 0) {
    const barW = (pw - 8) * 0.62 * (failed ? 1 : ease.out(loadP));
    ctx.fillStyle = failed ? P.alert : P.brass;
    ctx.fillRect(px + 4, py + ph - 4, barW, 2.6);
  }

  // error state
  const ep = ease.outQuint(seg(t, 1.95, 2.65));
  if (ep > 0) {
    ctx.save();
    ctx.globalAlpha *= ep;

    const gx = W / 2, gy = by + 232;
    ctx.strokeStyle = P.alert;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gx, gy, 44 * lerp(.82, 1, ep), 0, Math.PI * 2); ctx.stroke();
    const d = 15;
    ctx.beginPath();
    ctx.moveTo(gx - d, gy - d); ctx.lineTo(gx + d, gy + d);
    ctx.moveTo(gx + d, gy - d); ctx.lineTo(gx - d, gy + d);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = P.ink;
    ctx.font = '400 42px Inter, sans-serif';
    ctx.fillText("This site can't be reached", W / 2, by + 360);

    ctx.fillStyle = 'rgba(10,16,13,.45)';
    ctx.font = '500 21px Inter, sans-serif';
    tracked(ctx, 'ERR_NAME_NOT_RESOLVED', W / 2, by + 408, 3.4, 'center');
    ctx.textAlign = 'left';
    ctx.restore();
  }
  ctx.restore();

  // caption
  const cp = seg(t, 2.55, 3.25);
  rise(ctx, cp, W / 2 - 420, 1420, 840, 100, () => {
    ctx.textAlign = 'center';
    ctx.fillStyle = P.paper;
    ctx.font = 'italic 300 54px Fraunces, serif';
    ctx.fillText('Their Instagram bio', W / 2, 1478);
    ctx.fillStyle = P.brassSoft;
    ctx.fillText('still points here.', W / 2, 1548);
    ctx.textAlign = 'left';
  });
}

/* =========================================================================
   SCENE 3 — 7.4 → 12.4   the concept opens (the fix)
   ========================================================================= */
function sceneHero(ctx, t) {
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, W, H);

  // image opens from a horizontal band in the middle of the frame
  const open = ease.outQuint(seg(t, 0, 0.95));
  const zoom = lerp(1.16, 1.03, ease.inOut(seg(t, 0, 5)));
  const bandH = H * open;

  if (open > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, (H - bandH) / 2, W, bandH);
    ctx.clip();
    drawCover(ctx, IMG.hero, 0, 0, W, H, zoom, .5, .42);

    // cinematic grade
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(6,12,9,.74)');
    g.addColorStop(.34, 'rgba(6,12,9,.18)');
    g.addColorStop(.68, 'rgba(6,12,9,.55)');
    g.addColorStop(1, 'rgba(6,12,9,.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // eyebrow
  rise(ctx, seg(t, 0.8, 1.5), 96, 1160, 700, 40, () => {
    ctx.fillStyle = P.brassSoft;
    ctx.font = '500 22px Inter, sans-serif';
    tracked(ctx, 'IGATPURI  ·  SAHYADRI RANGE', 96, 1192, 8);
  });

  // headline, three lines, staggered
  const lines = [
    { txt: 'A hill estate', font: '300 104px Fraunces, serif', col: P.paper,  y: 1310, a: 1.0,  b: 1.8 },
    { txt: 'kept for the',  font: '300 104px Fraunces, serif', col: P.paper,  y: 1420, a: 1.35, b: 2.15 },
    { txt: 'weekends.',     font: 'italic 300 104px Fraunces, serif', col: P.brassSoft, y: 1530, a: 1.7, b: 2.5 }
  ];
  lines.forEach(l => {
    rise(ctx, seg(t, l.a, l.b), 88, l.y - 108, 900, 130, () => {
      ctx.fillStyle = l.col;
      ctx.font = l.font;
      ctx.fillText(l.txt, 92, l.y);
    });
  });

  // rule + meta row
  const rp = ease.outQuint(seg(t, 2.5, 3.3));
  ctx.save();
  ctx.strokeStyle = `rgba(244,241,233,${.28 * rp})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(92, 1658); ctx.lineTo(92 + 480 * rp, 1658); ctx.stroke();
  ctx.restore();

  const mp = ease.outQuint(seg(t, 2.7, 3.5));
  if (mp > 0) {
    ctx.save();
    ctx.globalAlpha *= mp;
    ctx.font = '500 21px Inter, sans-serif';

    let mx = 92;
    ctx.fillStyle = 'rgba(244,241,233,.72)';
    mx += tracked(ctx, '18 ACRES', mx, 1706, 6) + 34;

    ctx.fillStyle = P.brassSoft;
    mx += tracked(ctx, '101 NA PLOTS', mx, 1706, 6) + 34;

    ctx.fillStyle = 'rgba(244,241,233,.72)';
    tracked(ctx, 'IGATPURI', mx, 1706, 6);
    ctx.restore();
  }
}

/* =========================================================================
   SCENE 4 — 12.4 → 16.0   the numbers
   ========================================================================= */
function sceneNumbers(ctx, t) {
  // paper rises over the dark frame
  const cover = ease.outQuint(seg(t, 0, .55));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H * (1 - cover), W, H * cover);
  ctx.clip();
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, H);

  const rows = [
    { label: 'ACRES GATED', to: 18,    y: 520,  a: .35, b: 1.15, suffix: '' },
    { label: 'NA PLOTS',    to: 101,   y: 900,  a: .75, b: 1.6,  suffix: '' },
    { label: 'SQ FT EACH',  to: 2500,  y: 1280, a: 1.15, b: 2.1, suffix: '+' }
  ];

  rows.forEach((r, i) => {
    const p = ease.outQuint(seg(t, r.a, r.b));
    if (p <= 0) return;
    const val = Math.round(r.to * p);

    // hairline
    ctx.save();
    ctx.strokeStyle = `rgba(10,16,13,${.16 * p})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(92, r.y - 108); ctx.lineTo(92 + 896 * p, r.y - 108); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= p;
    ctx.fillStyle = P.ink;
    const size = r.to === 2500 ? fitFont(ctx, '2,500 – 5,000', 176, 896) : 176;
    ctx.font = `300 ${size}px Fraunces, serif`;
    const txt = val.toLocaleString('en-US');
    ctx.fillText(txt, 88, r.y);
    const w = ctx.measureText(txt).width;

    if (r.to === 2500 && p > .55) {
      // range instead of a single figure
      const rp = ease.outQuint(seg(t, 1.55, 2.2));
      ctx.globalAlpha *= rp;
      ctx.fillText('– 5,000', 88 + w + 16, r.y);
    }

    ctx.fillStyle = P.moss;
    ctx.font = '500 22px Inter, sans-serif';
    tracked(ctx, r.label, 96, r.y + 56, 7);
    ctx.restore();
  });

  // closing note
  rise(ctx, seg(t, 2.3, 3.0), 92, 1560, 700, 40, () => {
    ctx.fillStyle = P.moss;
    ctx.font = 'italic 300 36px Fraunces, serif';
    ctx.fillText('Availability on request.', 96, 1596);
  });
  ctx.restore();
}

/* =========================================================================
   SCENE 5 — 16.0 → 21.2   the interactive masterplan
   ========================================================================= */
const HOT = 9; // which plot gets tapped

function scenePlan(ctx, t) {
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createRadialGradient(W / 2, 1040, 0, W / 2, 1040, 820);
  g.addColorStop(0, 'rgba(195,154,92,.08)');
  g.addColorStop(1, 'rgba(195,154,92,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // header
  rise(ctx, seg(t, .1, .6), 92, 300, 700, 40, () => {
    ctx.fillStyle = P.brassSoft;
    ctx.font = '500 22px Inter, sans-serif';
    tracked(ctx, 'THE MASTERPLAN', 96, 332, 8);
  });
  rise(ctx, seg(t, .25, .85), 92, 380, 900, 90, () => {
    ctx.fillStyle = P.paper;
    ctx.font = '300 76px Fraunces, serif';
    ctx.fillText('Tap any plot.', 92, 452);
  });

  // contour lines
  const cp = ease.outQuint(seg(t, .3, 1.6));
  if (cp > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(159,176,164,${.20 * cp})`;
    ctx.lineWidth = 1.2;
    CONTOURS.forEach((pts, i) => {
      const local = clamp(cp * 1.6 - i * .09);
      if (local <= 0) return;
      const path = new Path2D();
      path.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const xc = (pts[k][0] + pts[k + 1][0]) / 2;
        const yc = (pts[k][1] + pts[k + 1][1]) / 2;
        path.quadraticCurveTo(pts[k][0], pts[k][1], xc, yc);
      }
      path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.save();
      ctx.setLineDash([1400, 1400]);
      ctx.lineDashOffset = 1400 * (1 - local);
      ctx.stroke(path);
      ctx.restore();
    });
    ctx.restore();
  }

  // the plots themselves, staggered in
  PLOTS.forEach((pl, i) => {
    const start = .95 + i * .055;
    const p = ease.outQuint(seg(t, start, start + .5));
    if (p <= 0) return;

    const hot = i === HOT;
    const tap = hot ? ease.outQuint(seg(t, 2.5, 2.9)) : 0;

    ctx.save();
    ctx.translate(pl.cx, pl.cy);
    const s = lerp(.72, 1, p);
    ctx.scale(s, s);
    ctx.globalAlpha *= p;

    ctx.beginPath();
    pl.pts.forEach((pt, k) => (k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
    ctx.closePath();

    if (hot) {
      ctx.fillStyle = `rgba(195,154,92,${.10 + .30 * tap})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(195,154,92,${.7 + .3 * tap})`;
      ctx.lineWidth = 2 + 1.4 * tap;
    } else {
      ctx.fillStyle = 'rgba(244,241,233,.028)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,241,233,.24)';
      ctx.lineWidth = 1.2;
    }
    ctx.stroke();
    ctx.restore();
  });

  // tap ripple
  const rp = seg(t, 2.5, 3.35);
  if (rp > 0 && rp < 1) {
    const pl = PLOTS[HOT];
    ctx.save();
    ctx.strokeStyle = `rgba(195,154,92,${.55 * (1 - rp)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pl.cx, pl.cy, lerp(20, 120, ease.outQuint(rp)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // detail card
  const cardP = ease.outQuint(seg(t, 2.95, 3.6));
  if (cardP > 0) {
    ctx.save();
    ctx.globalAlpha *= cardP;
    ctx.translate(0, (1 - cardP) * 70);

    const cx = 84, cy = 1452, cw = W - 168, ch = 236;
    roundRect(ctx, cx, cy, cw, ch, 20);
    ctx.fillStyle = P.paper;
    ctx.fill();

    ctx.fillStyle = 'rgba(10,16,13,.45)';
    ctx.font = '500 19px Inter, sans-serif';
    tracked(ctx, 'PLOT 47', cx + 40, cy + 62, 6);

    ctx.fillStyle = P.ink;
    ctx.font = '300 62px Fraunces, serif';
    ctx.fillText('3,200 sq ft', cx + 38, cy + 132);

    ctx.fillStyle = P.moss;
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillText('East facing · ridge view', cx + 40, cy + 176);

    // whatsapp button
    const bxp = cx + cw - 250, byp = cy + 96, bwid = 210, bhei = 62;
    roundRect(ctx, bxp, byp, bwid, bhei, 31);
    ctx.fillStyle = P.ink;
    ctx.fill();
    ctx.fillStyle = P.paper;
    ctx.font = '500 20px Inter, sans-serif';
    tracked(ctx, 'ENQUIRE  →', bxp + 30, byp + 39, 3);

    ctx.restore();
  }
}

/* =========================================================================
   SCENE 6 — 21.2 → 25.4   the enquiry writes itself
   ========================================================================= */
const CHAT_LINES = [
  "Hi, I'm interested in Plot 47",
  "(3,200 sq ft) at Unicus.",
  "Is it available for a site visit?"
];

function sceneChat(ctx, t) {
  ctx.fillStyle = P.ink2;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 700);
  g.addColorStop(0, 'rgba(37,211,102,.055)');
  g.addColorStop(1, 'rgba(37,211,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // caption
  rise(ctx, seg(t, .05, .5), 92, 400, 900, 70, () => {
    ctx.fillStyle = P.paper;
    ctx.font = '300 68px Fraunces, serif';
    ctx.fillText('One tap.', 92, 456);
  });
  rise(ctx, seg(t, .25, .7), 92, 480, 900, 50, () => {
    ctx.fillStyle = P.sage;
    ctx.font = '400 32px Inter, sans-serif';
    ctx.fillText('The message writes itself.', 92, 528);
  });

  // chat frame
  const fp = ease.outQuint(seg(t, .3, .95));
  ctx.save();
  ctx.globalAlpha *= fp;
  ctx.translate(0, (1 - fp) * 50);

  const fx = 76, fy = 620, fw = W - 152, fh = 800;
  roundRect(ctx, fx, fy, fw, fh, 26);
  ctx.fillStyle = '#0B1512';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,241,233,.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // header
  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, 26);
  ctx.clip();
  ctx.fillStyle = 'rgba(244,241,233,.045)';
  ctx.fillRect(fx, fy, fw, 108);
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(fx + 62, fy + 54, 26, 0, Math.PI * 2);
  ctx.fillStyle = P.ink3; ctx.fill();
  ctx.strokeStyle = P.brass; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx + 62, fy + 40); ctx.lineTo(fx + 74, fy + 62); ctx.lineTo(fx + 50, fy + 62);
  ctx.closePath(); ctx.stroke();

  ctx.fillStyle = P.paper;
  ctx.font = '500 28px Inter, sans-serif';
  ctx.fillText('Unicus Real Estate', fx + 106, fy + 50);
  ctx.fillStyle = 'rgba(159,176,164,.75)';
  ctx.font = '400 19px Inter, sans-serif';
  ctx.fillText('online', fx + 106, fy + 78);
  ctx.restore();

  // outgoing bubble writes itself
  const bp = ease.outQuint(seg(t, .55, .95));
  const total = CHAT_LINES.join('').length;
  const typed = Math.floor(total * seg(t, .95, 2.35));
  const bubbleH = 300;
  const bw = 760, bx = fx + fw - bw - 34, by = 880;

  ctx.save();
  ctx.globalAlpha *= bp;
  ctx.translate(0, (1 - bp) * 20);

  roundRect(ctx, bx, by, bw, bubbleH, 22);
  ctx.fillStyle = P.wa;
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(bx + bw - 24, by + 2);
  ctx.lineTo(bx + bw + 16, by - 8);
  ctx.lineTo(bx + bw + 4, by + 30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = P.waInk;
  ctx.font = '400 30px Inter, sans-serif';
  let remaining = typed;
  CHAT_LINES.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, remaining));
    if (shown) ctx.fillText(shown, bx + 34, by + 84 + i * 52);
    remaining -= line.length;
  });

  // blink caret while typing
  if (typed < total && Math.floor(t * 4) % 2 === 0) {
    const li = CHAT_LINES.findIndex((l, i) => CHAT_LINES.slice(0, i).join('').length + l.length > typed);
    if (li >= 0) {
      const before = CHAT_LINES.slice(0, li).join('').length;
      const partial = CHAT_LINES[li].slice(0, typed - before);
      const w = ctx.measureText(partial).width;
      ctx.fillStyle = P.waInk;
      ctx.fillRect(bx + 37 + w, by + 60 + li * 52, 2, 30);
    }
  }

  // delivered ticks + time
  const tp = ease.outQuint(seg(t, 2.4, 2.9));
  if (tp > 0) {
    ctx.save();
    ctx.globalAlpha *= tp;
    ctx.fillStyle = 'rgba(11,20,26,.52)';
    ctx.font = '400 20px Inter, sans-serif';
    ctx.fillText('11:42', bx + bw - 140, by + bubbleH - 24);

    ctx.strokeStyle = P.tick;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    const tx = bx + bw - 78, ty = by + bubbleH - 30;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 7, ty + 7); ctx.lineTo(tx + 19, ty - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx + 10, ty); ctx.lineTo(tx + 17, ty + 7); ctx.lineTo(tx + 29, ty - 8); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // faint "incoming" placeholder, keeps the frame from feeling empty
  const ip = ease.outQuint(seg(t, 2.9, 3.4));
  if (ip > 0) {
    ctx.save();
    ctx.globalAlpha *= 0.5 * ip;
    roundRect(ctx, fx + 34, 1250, 420, 96, 20);
    ctx.fillStyle = 'rgba(244,241,233,.06)';
    ctx.fill();
    ctx.fillStyle = 'rgba(244,241,233,.28)';
    ctx.font = '400 26px Inter, sans-serif';
    ctx.fillText('typing…', fx + 66, 1308);
    ctx.restore();
  }
  ctx.restore();
}

/* =========================================================================
   SCENE 7 — 25.4 → 30.0   end card
   ========================================================================= */
function sceneEnd(ctx, t) {
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createRadialGradient(W / 2, 900, 0, W / 2, 900, 880);
  g.addColorStop(0, 'rgba(195,154,92,.10)');
  g.addColorStop(1, 'rgba(195,154,92,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // rule
  const lp = ease.outQuint(seg(t, 0, .6));
  ctx.save();
  ctx.strokeStyle = `rgba(195,154,92,${.9 * lp})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 190 * lp, 690);
  ctx.lineTo(W / 2 + 190 * lp, 690);
  ctx.stroke();
  ctx.restore();

  // name
  rise(ctx, seg(t, .35, 1.05), 0, 740, W, 130, () => {
    ctx.textAlign = 'center';
    ctx.fillStyle = P.paper;
    ctx.font = '300 106px Fraunces, serif';
    ctx.fillText('Swaraj Patil', W / 2, 852);
    ctx.textAlign = 'left';
  });

  // role
  rise(ctx, seg(t, .7, 1.3), 0, 880, W, 46, () => {
    ctx.textAlign = 'center';
    ctx.fillStyle = P.sage;
    ctx.font = '400 30px Inter, sans-serif';
    ctx.fillText('Web developer & UI/UX designer, Nashik', W / 2, 924);
    ctx.textAlign = 'left';
  });

  // portfolio
  rise(ctx, seg(t, 1.15, 1.75), 0, 1030, W, 70, () => {
    ctx.textAlign = 'center';
    ctx.fillStyle = P.brassSoft;
    ctx.font = '500 42px Inter, sans-serif';
    tracked(ctx, 'swarajpatil1.netlify.app', W / 2, 1092, 2, 'center');
    ctx.textAlign = 'left';
  });

  // demo line
  rise(ctx, seg(t, 1.6, 2.2), 0, 1170, W, 44, () => {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,241,233,.55)';
    ctx.font = '400 25px Inter, sans-serif';
    ctx.fillText('Live demo · swarajpatil-tech.github.io/unicus-estate', W / 2, 1216);
    ctx.textAlign = 'left';
  });

  // closing mark + line
  const mp = ease.outQuint(seg(t, 2.3, 2.9));
  if (mp > 0) {
    ctx.save();
    ctx.globalAlpha *= mp;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,241,233,.72)';
    ctx.font = 'italic 300 40px Fraunces, serif';
    ctx.fillText('Websites for businesses that have none.', W / 2, 1500);
    ctx.textAlign = 'left';

    ctx.strokeStyle = P.brass;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(W / 2, 1650);
    ctx.lineTo(W / 2 + 24, 1692);
    ctx.lineTo(W / 2 - 24, 1692);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/* =========================================================================
   TIMELINE
   ========================================================================= */
const SCENES = [
  { id: 'lockup',   name: 'Mark',        start: 0,    end: 3.0,  draw: sceneLockup },
  { id: 'deadlink', name: 'Broken link', start: 3.0,  end: 7.4,  draw: sceneDeadLink },
  { id: 'hero',     name: 'Concept',     start: 7.4,  end: 12.4, draw: sceneHero },
  { id: 'numbers',  name: 'Numbers',     start: 12.4, end: 16.0, draw: sceneNumbers },
  { id: 'plan',     name: 'Masterplan',  start: 16.0, end: 21.2, draw: scenePlan },
  { id: 'chat',     name: 'Enquiry',     start: 21.2, end: 25.4, draw: sceneChat },
  { id: 'end',      name: 'End card',    start: 25.4, end: 30.0, draw: sceneEnd }
];

function sceneAt(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return SCENES[i];
  return SCENES[0];
}

function drawScene(sc, tAbs, alpha, dy) {
  if (alpha <= 0.001) return;
  c.save();
  c.globalAlpha = alpha;
  if (dy) c.translate(0, dy);
  sc.draw(c, tAbs - sc.start);
  c.restore();
}

const XF = 0.4; // crossfade length at every scene boundary

function renderAt(t) {
  const frame = Math.round(t * FPS);

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = P.ink;
  c.fillRect(0, 0, W, H);

  const sc = sceneAt(t);
  const i = SCENES.indexOf(sc);
  const lt = t - sc.start;
  const p = clamp(lt / XF);
  const e = ease.inOut(p);

  if (i > 0 && p < 1) {
    // the outgoing scene keeps playing underneath while the new one fades over it
    drawScene(SCENES[i - 1], t, 1 - e, -e * 14);
    drawScene(sc, t, e, (1 - ease.outQuint(p)) * 18);
  } else {
    drawScene(sc, t, 1, 0);
  }

  // finish: vignette, then grain on top of everything
  c.save();
  drawVignette(c, sc.id === 'numbers' ? 0.26 : 0.5);
  c.restore();
  c.save();
  drawGrain(c, frame);
  c.restore();

  c.restore();
}

/* =========================================================================
   REVIEW UI
   ========================================================================= */
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);

let current = 0, playing = true, last = performance.now(), ready = false;

function fmt(t) {
  const s = Math.floor(t), ms = Math.floor((t % 1) * 100);
  return `00:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function syncUI() {
  if ($('scrub')) $('scrub').value = String(current);
  if ($('clock')) $('clock').textContent = fmt(current);
  const sc = sceneAt(current);
  document.querySelectorAll('.chip').forEach(el => {
    el.classList.toggle('on', el.dataset.id === sc.id);
  });
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, .25);
  last = now;
  if (playing) {
    current = (current + dt) % DURATION;
    renderAt(current);
    syncUI();
  }
  requestAnimationFrame(loop);
}

async function boot() {
  await Promise.all([
    document.fonts.load('300 100px Fraunces'),
    document.fonts.load('italic 300 100px Fraunces'),
    document.fonts.load('400 30px Inter'),
    document.fonts.load('500 30px Inter'),
    loadImages()
  ]).catch(() => {});
  await document.fonts.ready;

  // build scene chips
  const chips = $('chips');
  if (chips) {
    chips.innerHTML = SCENES.map(s =>
      `<button class="chip" data-id="${s.id}" data-start="${s.start}">${s.name}</button>`
    ).join('');
    chips.querySelectorAll('.chip').forEach(el => {
      el.onclick = () => {
        current = parseFloat(el.dataset.start) + .01;
        renderAt(current); syncUI();
      };
    });
  }

  // frozen frame mode: ?t=12.4
  if (params.has('t')) {
    current = clamp(parseFloat(params.get('t')) || 0, 0, DURATION - .001);
    playing = false;
    document.body.classList.add('frozen');
    renderAt(current);
    syncUI();
  }

  ready = true;
  renderAt(current);              // paint immediately, before the first rAF tick
  document.body.classList.remove('loading');
  requestAnimationFrame(loop);

  // controls
  const setPlay = v => {
    playing = v;
    if ($('play')) $('play').textContent = v ? 'Pause' : 'Play';
  };
  setPlay(playing);

  $('play') && ($('play').onclick = () => setPlay(!playing));
  $('restart') && ($('restart').onclick = () => { current = 0; renderAt(0); syncUI(); });
  $('scrub') && ($('scrub').oninput = e => {
    setPlay(false);
    current = parseFloat(e.target.value);
    renderAt(current); syncUI();
  });

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); setPlay(!playing); }
    if (e.code === 'ArrowRight') { setPlay(false); current = clamp(current + 1 / FPS, 0, DURATION); renderAt(current); syncUI(); }
    if (e.code === 'ArrowLeft') { setPlay(false); current = clamp(current - 1 / FPS, 0, DURATION); renderAt(current); syncUI(); }
  });

  // record to a video file
  $('record') && ($('record').onclick = async () => {
    const btn = $('record');
    btn.disabled = true;
    btn.textContent = 'Recording…';

    const stream = canvas.captureStream(FPS);
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000 } : undefined);
    } catch (err) {
      btn.textContent = 'Not supported in this browser';
      btn.disabled = false;
      return;
    }
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'unicus-reel.' + ((mime || '').includes('mp4') ? 'mp4' : 'webm');
      a.click();
      btn.disabled = false;
      btn.textContent = 'Download video';
    };
    current = 0; setPlay(true); renderAt(0);
    rec.start();
    setTimeout(() => rec.stop(), DURATION * 1000 + 250);
  });
}

boot();
