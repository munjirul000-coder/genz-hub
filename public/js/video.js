/* Gen-Z Hub — feed video engine
   • অটো-প্লে যখন ভিডিও স্ক্রিনে আসে (মিউটেড, ব্রাউজার নীতির কারণে)
   • স্ক্রল করে সরে গেলেই সাথে সাথে থামে (সাউন্ড বন্ধ)
   • একসাথে শুধু একটাই ভিডিও চলবে
   • ইউজার নিজে pause করলে সেটাই মানা হয়
   • সাউন্ড টগল সেশনজুড়ে মনে রাখে
   • ট্যাব লুকালে বা পেজ বদলালে সব ভিডিও থামে                            */
(function () {
  'use strict';
  const G = window.GZ;

  const VISIBLE_IN = 0.6;    // এতটা দেখা গেলে চালু
  const VISIBLE_OUT = 0.35;  // এর নিচে নামলে থামাও
  let soundOn = false;       // সেশনজুড়ে সাউন্ড পছন্দ
  let current = null;

  function allVideos() { return document.querySelectorAll('video.gz-video'); }

  function pauseAll(except) {
    allVideos().forEach((v) => {
      if (v !== except && !v.paused) { v.pause(); }
      if (v !== except) v.muted = true;
    });
  }

  G.pauseAllVideos = function () {
    allVideos().forEach((v) => { try { v.pause(); v.muted = true; } catch (e) {} });
    current = null;
  };

  function syncSoundButton(v) {
    const wrap = v.closest('.vid-wrap');
    if (!wrap) return;
    const btn = wrap.querySelector('.vid-sound');
    if (!btn) return;
    const on = !v.muted;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-label', on ? 'Mute video' : 'Unmute video');
    btn.innerHTML = on ? '🔊' : '🔇';
    wrap.classList.toggle('is-playing', !v.paused);
  }

  function play(v) {
    if (v.dataset.userPaused === '1') return;
    pauseAll(v);
    v.muted = !soundOn;
    const pr = v.play();
    if (pr && pr.catch) pr.catch(() => { /* autoplay blocked → thumbnail থাকবে */ });
    current = v;
    syncSoundButton(v);
  }

  function stop(v) {
    if (!v.paused) v.pause();
    v.muted = true;
    v.dataset.userPaused = '';          // সরে গেলে ম্যানুয়াল pause রিসেট
    if (current === v) current = null;
    syncSoundButton(v);
  }

  function ratioOf(v) {
    const r = v.getBoundingClientRect();
    if (!r.height) return 0;
    const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return Math.max(0, Math.min(1, vis / r.height));
  }

  // IntersectionObserver-এর ইভেন্ট দেরিতে আসতে পারে (stale) — তাই হ্যান্ডেল করার সময়
  // আবার তাজা অবস্থান মেপে সিদ্ধান্ত নিই, নাহলে ফিরে আসা ভিডিও ভুলবশত থেমে যায়
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      const ratio = ratioOf(v);
      if (ratio >= VISIBLE_IN) play(v);
      else if (ratio < VISIBLE_OUT) stop(v);
    });
  }, { threshold: [0, 0.2, VISIBLE_OUT, VISIBLE_IN, 0.9] });
  let ticking = false;
  function tick() {
    ticking = false;
    let best = null, bestRatio = 0;
    allVideos().forEach((v) => {
      const ratio = ratioOf(v);
      if (ratio < VISIBLE_OUT) {
        if (!v.paused || v.dataset.userPaused === '1') stop(v);
      } else if (ratio >= VISIBLE_IN && ratio > bestRatio) { best = v; bestRatio = ratio; }
    });
    if (best && best.paused && best.dataset.userPaused !== '1') play(best);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  function attach(v) {
    if (v.dataset.gzAttached === '1') return;
    v.dataset.gzAttached = '1';
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('preload', 'metadata');

    // ইউজার নিজে থামালে সেটা মনে রাখো (দৃশ্যমান অবস্থায় থামালে)
    v.addEventListener('pause', () => {
      const r = v.getBoundingClientRect();
      const visible = r.top < innerHeight * 0.75 && r.bottom > innerHeight * 0.25;
      if (visible && !v.ended) v.dataset.userPaused = '1';
      syncSoundButton(v);
    });
    v.addEventListener('play', () => { v.dataset.userPaused = ''; pauseAll(v); current = v; syncSoundButton(v); });
    v.addEventListener('volumechange', () => syncSoundButton(v));
    v.addEventListener('ended', () => { v.dataset.userPaused = ''; syncSoundButton(v); });

    const wrap = v.closest('.vid-wrap');
    const btn = wrap && wrap.querySelector('.vid-sound');
    if (btn) {
      btn.onclick = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        soundOn = v.muted;                 // টগল
        v.muted = !soundOn;
        if (soundOn && v.paused) { v.dataset.userPaused = ''; play(v); }
        allVideos().forEach((o) => { if (o !== v) o.muted = true; });
        syncSoundButton(v);
      };
    }
    io.observe(v);
    syncSoundButton(v);
  }

  G.attachVideos = function (root) {
    (root || document).querySelectorAll('video.gz-video').forEach(attach);
  };

  // নতুন পোস্ট/ভিডিও DOM-এ এলে নিজে থেকেই ধরে নাও
  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches && n.matches('video.gz-video')) attach(n);
      else if (n.querySelectorAll) n.querySelectorAll('video.gz-video').forEach(attach);
    }));
  });
  const startMO = () => mo.observe(document.body, { childList: true, subtree: true });
  if (document.body) startMO(); else document.addEventListener('DOMContentLoaded', startMO);

  // ট্যাব লুকালে / রুট বদলালে সব থামাও
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pauseAllVideos(); });
  window.addEventListener('hashchange', () => G.pauseAllVideos());
  window.addEventListener('pagehide', () => G.pauseAllVideos());
})();
