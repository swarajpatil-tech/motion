/* =========================================================================
   VOICEOVER
   One clip per line, each fired at its own cue. Nothing accumulates drift,
   because no clip is longer than the beat it belongs to. Everything runs on
   the Web Audio clock, so the picture and the voice use the same timebase.
   ========================================================================= */
const VO_LINES = [
  { id: 'lockup',   label: 'Mark',        start: 0.4,  end: 2.9,
    line: 'A hill estate in Igatpuri. No website.' },
  { id: 'deadlink', label: 'Broken link', start: 3.2,  end: 6.9,
    line: "Their Instagram bio points to a domain that doesn't load." },
  { id: 'hero',     label: 'Concept',     start: 7.7,  end: 11.9,
    line: 'So I built what that link should have shown.' },
  { id: 'numbers',  label: 'Numbers',     start: 12.7, end: 15.7,
    line: 'Eighteen acres. A hundred and one plots.' },
  { id: 'plan',     label: 'Masterplan',  start: 16.3, end: 20.9,
    line: 'Tap any plot. It answers with the size and the enquiry.' },
  { id: 'chat',     label: 'Enquiry',     start: 21.5, end: 25.1,
    line: 'One tap. The message writes itself.' },
  { id: 'end',      label: 'End card',    start: 25.8, end: 29.4,
    line: 'Websites for businesses that have none. Swaraj Patil, Nashik.' }
];

const VO = {
  ctx: null, master: null, buffers: {}, full: null,
  fullOffset: 0, sources: [], recDest: null
};

function audioCtx() {
  if (!VO.ctx) VO.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (VO.ctx.state === 'suspended') VO.ctx.resume();
  return VO.ctx;
}

function voiceMaster() {
  if (!VO.master) {
    const ac = audioCtx();
    VO.master = ac.createGain();
    VO.master.gain.value = 1;
    VO.master.connect(ac.destination);       // you hear it
    if (VO.recDest) VO.master.connect(VO.recDest); // and it lands in the file
  }
  return VO.master;
}

function voLoaded() {
  if (VO.full) return true;
  return Object.keys(VO.buffers).length > 0;
}

// the list of clips to fire, in order, each with its absolute start time
function voClips() {
  if (VO.full) return [{ start: VO.fullOffset, buffer: VO.full }];
  return VO_LINES
    .filter(l => VO.buffers[l.id])
    .map(l => ({ start: l.start, buffer: VO.buffers[l.id] }));
}

function stopVO() {
  VO.sources.forEach(src => { try { src.stop(); } catch (e) {} });
  VO.sources = [];
}

// schedule every clip relative to a picture position
function scheduleVO(fromTime) {
  stopVO();
  if (!voLoaded()) return;
  const ac = audioCtx();
  const now = ac.currentTime + 0.1;   // a little headroom before the first cue
  const out = voiceMaster();

  voClips().forEach(clip => {
    const rel = clip.start - fromTime;
    const dur = clip.buffer.duration;
    let when, offset = 0, playDur = dur;

    if (rel >= 0) {
      when = now + rel;
    } else if (rel + dur > 0) {
      when = now;                    // you started mid-clip: join it late
      offset = -rel;
      playDur = dur - offset;
    } else {
      return;                        // already finished before this point
    }

    const src = ac.createBufferSource();
    src.buffer = clip.buffer;
    src.connect(out);
    src.start(when, offset, playDur);
    VO.sources.push(src);
  });
}

async function loadVO(id, file) {
  try {
    const ac = audioCtx();
    const buf = await ac.decodeAudioData(await file.arrayBuffer());
    if (id === 'full') VO.full = buf;
    else VO.buffers[id] = buf;
    return buf.duration;
  } catch (err) {
    return null;
  }
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

/* ---------- voiceover panel ---------- */
function buildVOPanel() {
  const rows = $('voRows');
  if (!rows) return;

  const fullRow = document.createElement('div');
  fullRow.className = 'vorow';
  fullRow.innerHTML = `
    <div class="vometa"><b>Full take</b><span>one file, shifted by the offset below</span></div>
    <input type="file" accept="audio/*" data-vo="full">`;
  rows.appendChild(fullRow);

  VO_LINES.forEach(l => {
    const row = document.createElement('div');
    row.className = 'vorow';
    row.innerHTML = `
      <div class="vometa">
        <b>${fmt(l.start).slice(3, 8)} · ${l.label}</b>
        <span>${l.line}</span>
      </div>
      <input type="file" accept="audio/*" data-vo="${l.id}">`;
    rows.appendChild(row);
  });

  rows.querySelectorAll('input[type=file]').forEach(input => {
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const dur = await loadVO(input.dataset.vo, file);
      const lbl = input.parentElement.querySelector('div.vometa b');
      const base = input.dataset.vo === 'full'
        ? 'Full take'
        : `${fmt(VO_LINES.find(l => l.id === input.dataset.vo).start).slice(3, 8)} · ${VO_LINES.find(l => l.id === input.dataset.vo).label}`;
      if (dur) {
        lbl.textContent = `${base} — ${dur.toFixed(2)}s`;
        input.parentElement.classList.add('on');
        if (input.dataset.vo === 'full') VO.buffers = {};
        else VO.full = null;
      } else {
        lbl.textContent = `${base} — could not read that file`;
      }
      if ($('voState')) $('voState').textContent = voLoaded() ? 'loaded' : 'none loaded';
      if (playing) scheduleVO(current);
    };
  });

  const off = $('voOffset');
  if (off) off.oninput = () => {
    VO.fullOffset = parseFloat(off.value) || 0;
    if (playing) scheduleVO(current);
  };

  const clr = $('voClear');
  if (clr) clr.onclick = () => {
    VO.buffers = {}; VO.full = null; VO.fullOffset = 0;
    stopVO();
    rows.querySelectorAll('.vorow').forEach(r => {
      r.classList.remove('on');
      const i = r.querySelector('input[type=file]');
      if (i) i.value = '';
    });
    rows.querySelectorAll('.vometa b').forEach((b, i) => {
      if (i === 0) b.textContent = 'Full take';
      else b.textContent = `${fmt(VO_LINES[i - 1].start).slice(3, 8)} · ${VO_LINES[i - 1].label}`;
    });
    if ($('voOffset')) $('voOffset').value = '0';
    if ($('voState')) $('voState').textContent = 'none loaded';
  };
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

  const chips = $('chips');
  if (chips) {
    chips.innerHTML = SCENES.map(s =>
      `<button class="chip" data-id="${s.id}" data-start="${s.start}">${s.name}</button>`
    ).join('');
    chips.querySelectorAll('.chip').forEach(el => {
      el.onclick = () => {
        current = parseFloat(el.dataset.start) + .01;
        renderAt(current); syncUI();
        if (playing) scheduleVO(current);
      };
    });
  }

  buildVOPanel();
  if (params.has('openvo') && $('voPanel')) $('voPanel').open = true;

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

  const setPlay = v => {
    playing = v;
    if ($('play')) $('play').textContent = v ? 'Pause' : 'Play';
    if (v) scheduleVO(current);
    else stopVO();
  };
  setPlay(playing);

  $('play') && ($('play').onclick = () => setPlay(!playing));
  $('restart') && ($('restart').onclick = () => {
    current = 0; renderAt(0); syncUI();
    if (playing) scheduleVO(0);
  });
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

  /* ---------- record the whole thing, picture + voice ---------- */
  $('record') && ($('record').onclick = async () => {
    const btn = $('record');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Recording…';

    const ac = audioCtx();
    const dest = ac.createMediaStreamDestination();
    VO.recDest = dest;
    if (VO.master) VO.master.connect(dest);

    const vStream = canvas.captureStream(FPS);
    const tracks = [...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const stream = new MediaStream(tracks);

    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000 } : undefined);
    } catch (err) {
      btn.textContent = 'Recording not supported here';
      btn.disabled = false;
      return;
    }

    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopVO();
      try { VO.master && VO.master.disconnect(dest); } catch (e) {}
      VO.recDest = null;
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'unicus-reel.' + ((mime || '').includes('mp4') ? 'mp4' : 'webm');
      a.click();
      btn.disabled = false;
      btn.textContent = original;
    };

    current = 0;
    playing = true;
    if ($('play')) $('play').textContent = 'Pause';
    renderAt(0);
    syncUI();

    rec.start();
    scheduleVO(0);
    setTimeout(() => rec.stop(), DURATION * 1000 + 400);
  });
}

boot();
