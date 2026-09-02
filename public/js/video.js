/* Bloom — feed video engine  ("VOLT Player")
   ---------------------------------------------------------------------------
   একটাই লক্ষ্য: TikTok/Reels-এর মতো স্মুথ স্ক্রল, কিন্তু Bloom-এর নিজস্ব UI।

   • Lazy: ভিডিও এলিমেন্ট তৈরিই হয় না যতক্ষণ না viewport-এর কাছাকাছি আসে (আগে শুধু poster)
   • একসাথে সর্বোচ্চ ৩টি <video> DOM-এ থাকে — বাকিগুলো detach (memory + network বাঁচে)
   • শুধু সবচেয়ে দৃশ্যমান ভিডিও চলে; স্ক্রল করলেই আগেরটা সাথে সাথে pause
   • পরের ভিডিওটি শুধু metadata preload করে — পুরো ফিড কখনো download হয় না
   • Adaptive quality: network speed + screen size + buffer health দেখে rendition বাছে
   • Range request দিয়ে seek, stall হলে অটো নিচের quality, ভালো হলে আবার উপরে             */
(function () {
  'use strict';
  const G = window.GZ || (window.GZ = {});

  /* ------------------------------------------------------------- tuning */
  const PLAY_IN = 0.62;        // এত অংশ দেখা গেলে চালু
  const PLAY_OUT = 0.38;       // এর নিচে নামলে থামাও
  const ATTACH_MARGIN = '150% 0px';  // এই দূরত্বে এলে <video> তৈরি হবে
  const MAX_ATTACHED = 3;      // একসাথে জীবিত video element
  const STALL_WINDOW = 12000;  // ms
  const UPSHIFT_AFTER = 14000; // ms of healthy playback before trying better quality

  const players = new Map();   // element → state
  let soundOn = false;         // session-wide sound preference
  let active = null;
  let order = [];              // players in document order (recomputed lazily)

  /* ------------------------------------------------------------- network */
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const netState = { bps: 0, stalls: 0 };

  function saveData() { return !!(conn && conn.saveData); }

  /** Rough downlink estimate in bits/sec. connection.downlink where available, else optimistic. */
  function estimateBps() {
    if (netState.bps) return netState.bps;
    if (conn && conn.downlink) return conn.downlink * 1e6 * 0.72; // downlink is a max, be conservative
    if (conn && conn.effectiveType) {
      return ({ 'slow-2g': 100e3, '2g': 250e3, '3g': 900e3, '4g': 6e6 })[conn.effectiveType] || 3e6;
    }
    return 4e6;
  }
  if (conn && conn.addEventListener) conn.addEventListener('change', () => { netState.bps = 0; });

  // Rough per-rendition bitrate need (bits/s) — matches the server ladder.
  const NEED = { 1080: 6.0e6, 720: 3.4e6, 480: 1.7e6, 360: 0.9e6 };
  function needFor(h) { return NEED[h] || Math.max(0.5e6, h * 2600); }

  /* ------------------------------------------------------------- helpers */
  function parseData(box) {
    try { return JSON.parse(box.getAttribute('data-gzv') || '{}'); } catch (e) { return {}; }
  }

  function variantsOf(st) {
    const v = (st.data.variants || []).slice().sort((a, b) => (b.h || 0) - (a.h || 0));
    if (!v.length && st.data.url) v.push({ h: st.data.height || 0, url: st.data.url, label: 'Original' });
    return v;
  }

  /** Pick the best honest rendition for this moment. */
  function chooseVariant(st) {
    const list = variantsOf(st);
    if (!list.length) return null;
    if (st.pinned) {
      const hit = list.find((v) => String(v.h) === String(st.pinned));
      if (hit) return hit;
    }
    if (saveData()) return list[list.length - 1];

    // 1. screen cap — never download more pixels than we can show
    const cssW = st.box.clientWidth || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const shortSideNeeded = Math.round(Math.min(cssW * dpr, 1080));
    // 2. bandwidth cap
    const bps = estimateBps() * (st.stallPenalty || 1);
    let pick = null;
    for (const v of list) {
      const fitsScreen = !v.h || v.h <= shortSideNeeded * 1.34;
      const fitsNet = !v.h || needFor(v.h) <= bps;
      if (fitsScreen && fitsNet) { pick = v; break; }
    }
    return pick || list[list.length - 1];
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }

  /* ------------------------------------------------------------- hydrate */
  function hydrate(box) {
    if (players.has(box)) return players.get(box);
    const data = parseData(box);
    const st = {
      box, data, video: null, attached: false, ratio: 0, userPaused: false,
      pinned: null, stallPenalty: 1, stallTimes: [], goodSince: 0, currentH: null, seeking: false,
      pendingWatch: 0, watchedTotal: 0, lastWatchReport: 0, lastVideoTime: 0, started: false, ended: false, skipSent: false,
    };
    players.set(box, st);

    const w = data.width || 16, h = data.height || 9;
    const ratio = w && h ? w / h : 16 / 9;
    box.style.setProperty('--gzv-ar', String(ratio));
    box.classList.toggle('is-portrait', ratio < 0.95);
    box.innerHTML = `
      <div class="gzv-stage">
        ${data.poster ? `<img class="gzv-poster" src="${data.poster}" alt="Video thumbnail" loading="lazy" decoding="async">` : '<div class="gzv-poster gzv-poster-blank"></div>'}
        <div class="gzv-spin" hidden><span></span></div>
        <button type="button" class="gzv-big" aria-label="Play video"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5.6v12.8L19 12z" fill="currentColor"/></svg></button>
        <div class="gzv-badge" ${data.status === 'processing' ? '' : 'hidden'}>Processing…</div>
      </div>
      <div class="gzv-bar">
        <button type="button" class="gzv-btn gzv-play" aria-label="Play or pause">${playIcon()}</button>
        <div class="gzv-seek" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="gzv-buf"></div><div class="gzv-prog"><i></i></div>
        </div>
        <span class="gzv-time">0:00 / ${fmtTime(data.duration || 0)}</span>
        <button type="button" class="gzv-btn gzv-q" aria-label="Video quality">Auto</button>
        <button type="button" class="gzv-btn gzv-snd" aria-label="Unmute video">${soundIcon(false)}</button>
        <button type="button" class="gzv-btn gzv-full" aria-label="Fullscreen">${fsIcon()}</button>
      </div>
      <div class="gzv-menu" hidden></div>`;

    const q = (s) => box.querySelector(s);
    st.ui = {
      stage: q('.gzv-stage'), poster: q('.gzv-poster'), spin: q('.gzv-spin'), big: q('.gzv-big'),
      play: q('.gzv-play'), seek: q('.gzv-seek'), prog: q('.gzv-prog'), buf: q('.gzv-buf'),
      time: q('.gzv-time'), quality: q('.gzv-q'), sound: q('.gzv-snd'), full: q('.gzv-full'),
      menu: q('.gzv-menu'), badge: q('.gzv-badge'),
    };

    st.ui.big.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(st); });
    st.ui.play.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(st); });
    st.ui.stage.addEventListener('click', () => togglePlay(st));
    st.ui.sound.addEventListener('click', (e) => { e.stopPropagation(); setSound(!soundOn, st); });
    st.ui.full.addEventListener('click', (e) => { e.stopPropagation(); goFullscreen(st); });
    st.ui.quality.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(st); });
    bindSeek(st);

    if (data.status === 'processing') pollProcessing(st);
    attachObservers(box);
    order = [];
    return st;
  }

  function playIcon() { return '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M8 5.6v12.8L19 12z" fill="currentColor"/></svg>'; }
  function pauseIcon() { return '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="7" y="5.5" width="3.4" height="13" rx="1.1" fill="currentColor"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1.1" fill="currentColor"/></svg>'; }
  function soundIcon(on) {
    return on
      ? '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor"/><path d="M15.4 9a4 4 0 0 1 0 6M17.9 6.6a7.4 7.4 0 0 1 0 10.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor"/><path d="M15.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
  }
  function fsIcon() { return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>'; }

  /* ------------------------------------------------------------- recommendation telemetry */
  function videoPostId(st) {
    const card = st.box && st.box.closest ? st.box.closest('[data-post]') : null;
    return card ? Number(card.dataset.post) : 0;
  }
  function trackVideo(st, action, value, extra) {
    const postId = videoPostId(st);
    if (postId && G.trackActivity) G.trackActivity(action, Object.assign({ post_id: postId, value: value || 1 }, extra || {}));
  }
  function reportWatch(st, force) {
    if (!st.pendingWatch || (!force && performance.now() - st.lastWatchReport < 8000)) return;
    const duration = st.video ? (st.video.duration || st.data.duration || 0) : (st.data.duration || 0);
    const current = st.video ? (st.video.currentTime || 0) : 0;
    trackVideo(st, 'video_watch', Math.min(30, st.pendingWatch), {
      metadata: { duration, current, completion: duration ? current / duration * 100 : 0 },
    });
    st.pendingWatch = 0;
    st.lastWatchReport = performance.now();
  }
  function trackPlayback(st) {
    if (!st.video) return;
    const current = st.video.currentTime || 0;
    const delta = current - (st.lastVideoTime || 0);
    if (delta > 0 && delta < 2.5) { st.pendingWatch += delta; st.watchedTotal += delta; }
    st.lastVideoTime = current;
    reportWatch(st, false);
  }

  /* ------------------------------------------------------------- video element */
  function attach(st, { autoplay }) {
    if (st.attached) { if (autoplay) play(st); return; }
    const v = document.createElement('video');
    v.className = 'gzv-video';
    v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.preload = autoplay ? 'auto' : 'metadata';
    v.muted = true; v.disablePictureInPicture = false;
    if (st.data.poster) v.poster = st.data.poster;
    const chosen = chooseVariant(st);
    if (!chosen) return;
    st.currentH = chosen.h;
    v.src = chosen.url;
    updateQualityLabel(st);

    v.addEventListener('waiting', () => { onStall(st); showSpin(st, true); });
    v.addEventListener('playing', () => {
      if (!st.started) { trackVideo(st, 'video_start', 1); st.started = true; }
      else if (st.ended) { trackVideo(st, 'video_replay', 1, { metadata: { duration: st.video.duration || st.data.duration || 0 } }); }
      st.ended = false; st.skipSent = false; st.lastVideoTime = st.video.currentTime || 0;
      showSpin(st, false); st.box.classList.add('is-playing'); st.ui.play.innerHTML = pauseIcon(); markGood(st);
    });
    v.addEventListener('canplay', () => showSpin(st, false));
    v.addEventListener('pause', () => {
      reportWatch(st, true);
      const duration = st.video.duration || st.data.duration || 0;
      if (!st.skipSent && st.watchedTotal < 3 && (st.video.currentTime || 0) < Math.max(3, duration * 0.2)) {
        trackVideo(st, 'video_skip', 1, { metadata: { duration, current: st.video.currentTime || 0 } });
        st.skipSent = true;
      }
      st.box.classList.remove('is-playing'); st.ui.play.innerHTML = playIcon();
    });
    v.addEventListener('timeupdate', () => { trackPlayback(st); paint(st); });
    v.addEventListener('progress', () => { paintBuffer(st); measure(st); });
    v.addEventListener('loadedmetadata', () => {
      if (!st.data.width && v.videoWidth) {
        st.box.style.setProperty('--gzv-ar', String(v.videoWidth / v.videoHeight));
        st.box.classList.toggle('is-portrait', v.videoWidth / v.videoHeight < 0.95);
      }
      paint(st);
    });
    v.addEventListener('ended', () => {
      reportWatch(st, true);
      if (!st.ended) trackVideo(st, 'video_complete', 1, { metadata: { duration: st.video.duration || st.data.duration || 0, current: st.video.duration || st.data.duration || 0, completion: 100 } });
      st.ended = true; st.box.classList.remove('is-playing'); st.ui.play.innerHTML = playIcon(); st.ui.big.hidden = false;
    });
    v.addEventListener('error', () => { showSpin(st, false); downshift(st, true); });

    st.ui.stage.appendChild(v);
    st.video = v; st.attached = true;
    st.loadStart = performance.now();
    if (autoplay) play(st);
    trimPool();
  }

  function detach(st) {
    if (!st.attached) return;
    const v = st.video;
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    v.remove();
    st.video = null; st.attached = false; st.userPaused = false;
    st.box.classList.remove('is-playing');
    st.ui.big.hidden = false;
    st.ui.play.innerHTML = playIcon();
    showSpin(st, false);
    if (active === st) active = null;
  }

  /** Never keep more than MAX_ATTACHED <video> elements alive (long-feed virtualisation). */
  function trimPool() {
    const live = [...players.values()].filter((s) => s.attached);
    if (live.length <= MAX_ATTACHED) return;
    live
      .filter((s) => s !== active)
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, live.length - MAX_ATTACHED)
      .forEach(detach);
  }

  /* ------------------------------------------------------------- playback */
  function play(st) {
    if (!st.attached) return attach(st, { autoplay: true });
    if (st.userPaused) return;
    players.forEach((o) => { if (o !== st && o.video && !o.video.paused) { o.video.pause(); o.video.muted = true; } });
    active = st;
    st.video.muted = !soundOn;
    st.ui.big.hidden = true;
    const p = st.video.play();
    if (p && p.catch) p.catch(() => { st.ui.big.hidden = false; /* autoplay blocked → poster stays */ });
    markGood(st);
  }

  function pause(st) {
    if (st.video && !st.video.paused) st.video.pause();
    if (st.video) st.video.muted = true;
    st.box.classList.remove('is-playing');
    if (active === st) active = null;
  }

  function togglePlay(st) {
    if (!st.attached) { st.userPaused = false; attach(st, { autoplay: true }); return; }
    if (st.video.paused) { st.userPaused = false; play(st); }
    else { st.userPaused = true; pause(st); st.ui.big.hidden = false; }
  }

  function setSound(on, st) {
    soundOn = on;
    players.forEach((s) => {
      s.ui.sound.innerHTML = soundIcon(on);
      s.ui.sound.classList.toggle('on', on);
      s.ui.sound.setAttribute('aria-label', on ? 'Mute video' : 'Unmute video');
      if (s.video) s.video.muted = s === (active || st) ? !on : true;
    });
    if (on && st && st.video && st.video.paused && !st.userPaused) play(st);
  }
  G.videoSound = (on) => setSound(!!on, active);

  /* ------------------------------------------------------------- adaptive */
  function measure(st) {
    if (!st.video || !st.loadStart) return;
    const b = st.video.buffered;
    if (!b.length) return;
    const secs = b.end(b.length - 1) - b.start(0);
    const elapsed = (performance.now() - st.loadStart) / 1000;
    if (elapsed < 1.2 || secs < 1) return;
    const bitrate = needFor(st.currentH || 720);
    const observed = (secs * bitrate) / elapsed;      // bits actually delivered per second
    netState.bps = netState.bps ? netState.bps * 0.7 + observed * 0.3 : observed;
    maybeUpshift(st);
  }

  function markGood(st) { st.goodSince = st.goodSince || performance.now(); }

  function onStall(st) {
    const t = performance.now();
    st.stallTimes = st.stallTimes.filter((x) => t - x < STALL_WINDOW);
    st.stallTimes.push(t);
    st.goodSince = 0;
    if (st.stallTimes.length >= 2) { st.stallTimes = []; downshift(st); }
  }

  function switchTo(st, variant) {
    if (!st.video || !variant || variant.url === st.video.currentSrc) return;
    const time = st.video.currentTime;
    const wasPlaying = !st.video.paused;
    st.currentH = variant.h;
    st.video.src = variant.url;
    st.video.currentTime = time;
    st.loadStart = performance.now();
    if (wasPlaying) { const p = st.video.play(); if (p && p.catch) p.catch(() => {}); }
    updateQualityLabel(st);
  }

  function downshift(st, silent) {
    if (st.pinned) return;
    const list = variantsOf(st);
    const idx = list.findIndex((v) => v.h === st.currentH);
    if (idx < 0 || idx >= list.length - 1) return;
    st.stallPenalty = Math.max(0.35, (st.stallPenalty || 1) * 0.6);
    st.goodSince = 0;
    switchTo(st, list[idx + 1]);
    if (!silent) st.box.classList.add('did-adapt');
  }

  function maybeUpshift(st) {
    if (st.pinned || !st.video || !st.goodSince) return;
    if (performance.now() - st.goodSince < UPSHIFT_AFTER) return;
    const b = st.video.buffered;
    const ahead = b.length ? b.end(b.length - 1) - st.video.currentTime : 0;
    if (ahead < 10) return;
    const list = variantsOf(st);
    const idx = list.findIndex((v) => v.h === st.currentH);
    if (idx <= 0) return;
    st.stallPenalty = Math.min(1, (st.stallPenalty || 1) * 1.4);
    const better = list[idx - 1];
    if (needFor(better.h) > estimateBps() * 0.85) return;
    const cssW = st.box.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
    if (better.h > cssW * 1.34) return;                 // pointless: more pixels than the screen shows
    st.goodSince = performance.now();
    switchTo(st, better);
  }

  function updateQualityLabel(st) {
    const auto = !st.pinned;
    const h = st.currentH;
    st.ui.quality.textContent = (auto ? 'Auto' : '') + (h ? (auto ? ' · ' : '') + h + 'p' : '');
  }

  function toggleMenu(st) {
    const m = st.ui.menu;
    if (!m.hidden) { m.hidden = true; return; }
    const list = variantsOf(st);
    m.innerHTML = `<button type="button" data-h="auto" class="${st.pinned ? '' : 'on'}">Auto</button>` +
      list.map((v) => `<button type="button" data-h="${v.h}" class="${String(st.pinned) === String(v.h) ? 'on' : ''}">${v.label || (v.h + 'p')}${v.source === 'original' ? ' · original' : ''}</button>`).join('');
    m.hidden = false;
    m.querySelectorAll('button').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const h = btn.dataset.h;
        st.pinned = h === 'auto' ? null : Number(h);
        st.stallPenalty = 1;
        if (!st.attached) attach(st, { autoplay: false });
        else switchTo(st, chooseVariant(st));
        updateQualityLabel(st);
        m.hidden = true;
      };
    });
  }
  document.addEventListener('click', () => players.forEach((s) => { if (s.ui && s.ui.menu) s.ui.menu.hidden = true; }));

  /* ------------------------------------------------------------- ui paint */
  function showSpin(st, on) { if (st.ui.spin) st.ui.spin.hidden = !on; }

  function paint(st) {
    if (!st.video) return;
    const d = st.video.duration || st.data.duration || 0;
    const c = st.video.currentTime || 0;
    const pct = d ? (c / d) * 100 : 0;
    if (!st.seeking) st.ui.prog.style.width = pct + '%';
    st.ui.time.textContent = fmtTime(c) + ' / ' + fmtTime(d);
    st.ui.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
    if (st.ui.poster && c > 0.05) st.ui.poster.classList.add('gone');
  }

  function paintBuffer(st) {
    if (!st.video) return;
    const b = st.video.buffered;
    const d = st.video.duration || 0;
    if (!b.length || !d) return;
    st.ui.buf.style.width = Math.min(100, (b.end(b.length - 1) / d) * 100) + '%';
  }

  function bindSeek(st) {
    const bar = st.ui.seek;
    const seekTo = (clientX) => {
      if (!st.video || !st.video.duration) return;
      const r = bar.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      st.video.currentTime = p * st.video.duration;
      st.ui.prog.style.width = p * 100 + '%';
    };
    bar.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); st.seeking = true; bar.setPointerCapture(e.pointerId); seekTo(e.clientX);
    });
    bar.addEventListener('pointermove', (e) => { if (st.seeking) seekTo(e.clientX); });
    bar.addEventListener('pointerup', (e) => { st.seeking = false; seekTo(e.clientX); });
    bar.addEventListener('click', (e) => e.stopPropagation());
    bar.addEventListener('keydown', (e) => {
      if (!st.video) return;
      if (e.key === 'ArrowRight') { st.video.currentTime += 5; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { st.video.currentTime -= 5; e.preventDefault(); }
    });
  }

  function goFullscreen(st) {
    if (!st.attached) attach(st, { autoplay: true });
    const el = st.video || st.box;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    (el.requestFullscreen || el.webkitEnterFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  }

  /* ------------------------------------------------------------- processing poll */
  function pollProcessing(st) {
    const uid = st.data.asset_uid;
    if (!uid) return;
    let tries = 0;
    const tick = () => {
      if (!document.body.contains(st.box) || tries++ > 120) return;
      fetch('/api/media/video/' + uid, { headers: { 'X-GenZ-Client': '1' } })
        .then((r) => r.json())
        .then((d) => {
          const a = d.asset;
          if (!a) return;
          if (a.status === 'ready' && a.variants.length) {
            st.data.variants = a.variants;
            st.data.poster = a.poster || st.data.poster;
            st.ui.badge.hidden = true;
            if (a.poster && st.ui.poster && st.ui.poster.tagName === 'IMG') st.ui.poster.src = a.poster;
          } else if (a.status === 'failed') {
            st.ui.badge.hidden = false; st.ui.badge.textContent = 'Video processing failed.';
          } else {
            st.ui.badge.hidden = false;
            st.ui.badge.textContent = 'Processing… ' + (a.progress || 0) + '%';
            setTimeout(tick, 2500);
          }
        })
        .catch(() => {});
    };
    tick();
  }

  /* ------------------------------------------------------------- observers */
  let io = null;
  function ensureObserver() {
    if (io) return io;
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const st = players.get(e.target);
        if (st) st.ratio = e.intersectionRatio;
      });
      schedule();
    }, { threshold: [0, 0.1, 0.25, 0.38, 0.5, 0.62, 0.8, 1] });
    return io;
  }

  let nearIo = null;
  function ensureNearObserver() {
    if (nearIo) return nearIo;
    nearIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const st = players.get(e.target);
        if (st) st.near = e.isIntersecting;
        if (st && !e.isIntersecting && st.attached && st !== active) detach(st);
      });
      schedule();
    }, { rootMargin: ATTACH_MARGIN, threshold: 0 });
    return nearIo;
  }

  function attachObservers(box) { ensureObserver().observe(box); ensureNearObserver().observe(box); }

  let raf = 0;
  let lastScroll = 0;
  let settleTimer = 0;
  const SETTLE_MS = 160;   // দ্রুত স্ক্রলে প্রতিটা ভিডিও লোড না করে, থামার পর যেটা সামনে সেটাই চালু হবে
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; evaluate(); }); }
  function scheduleSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settleTimer = 0; evaluate(); }, SETTLE_MS);
  }

  /** Fresh geometry every time — IntersectionObserver entries can be stale during fast scrolls. */
  function ratioOf(box) {
    const r = box.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.height <= 0) return 0;
    const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return visible / Math.min(r.height, vh);
  }

  function docOrder() {
    if (order.length === players.size) return order;
    order = [...players.keys()]
      .filter((b) => document.body.contains(b))
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((b) => players.get(b));
    return order;
  }

  function evaluate() {
    // drop players whose DOM was replaced by a re-render
    [...players.keys()].forEach((box) => {
      if (!document.body.contains(box)) { const st = players.get(box); if (st) detach(st); players.delete(box); order = []; }
    });

    let best = null;
    let centered = null;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    players.forEach((st) => {
      st.ratio = ratioOf(st.box);
      if (st.ratio >= PLAY_IN && (!best || st.ratio > best.ratio)) best = st;
      // fallback: a video sitting across the middle of the screen is clearly "the one being watched",
      // even if the card is taller than the viewport or partially cut off at the edge
      const r = st.box.getBoundingClientRect();
      if (r.top < vh * 0.5 && r.bottom > vh * 0.5 && st.ratio >= 0.42 && (!centered || st.ratio > centered.ratio)) centered = st;
    });
    if (!best) best = centered;

    // pause + release anything that scrolled away
    players.forEach((st) => {
      if (st === best) return;
      if (st.ratio < PLAY_OUT) {
        st.userPaused = false;                 // manual pause resets once it leaves the screen
        if (st.video && !st.video.paused) pause(st);
        else if (st.video) st.video.muted = true;
      }
    });

    // While the finger/wheel is still moving we only PAUSE — starting playback (and its download)
    // waits until the scroll settles, so flicking past 20 videos does not fetch 20 videos.
    if (best && performance.now() - lastScroll < SETTLE_MS && best !== active) {
      scheduleSettle();
      trimPool();
      return;
    }

    if (best) {
      if (!best.attached) attach(best, { autoplay: !best.userPaused });
      else if (best.video.paused && !best.userPaused) play(best);
      else if (best.video && !best.video.paused) active = best;
      preloadNext(best);
    } else if (active && active.ratio < PLAY_OUT) {
      pause(active);
    }
    trimPool();
  }

  /** Only the NEXT video gets a metadata head start. Never the whole feed. */
  function preloadNext(current) {
    const list = docOrder();
    const i = list.indexOf(current);
    if (i < 0) return;
    const next = list[i + 1];
    if (!next || !next.near || next.attached) return;
    if (saveData()) return;
    if (estimateBps() < 1.2e6) return;         // slow network → don't steal bandwidth
    if (current.video && current.video.readyState < 3) return; // current one first
    attach(next, { autoplay: false });
  }

  /* ------------------------------------------------------------- lifecycle */
  G.pauseAllVideos = function () {
    players.forEach((st) => { if (st.video) { try { st.video.pause(); st.video.muted = true; } catch (e) {} } });
    active = null;
  };

  G.scanVideos = function () {
    document.querySelectorAll('.gzv').forEach(hydrate);
    schedule();
  };

  const mo = new MutationObserver(() => { G.scanVideos(); });
  function boot() {
    mo.observe(document.body, { childList: true, subtree: true });
    G.scanVideos();
    window.addEventListener('scroll', () => { lastScroll = performance.now(); schedule(); scheduleSettle(); }, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', G.pauseAllVideos);
    window.addEventListener('pagehide', G.pauseAllVideos);
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.pauseAllVideos(); else schedule(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
