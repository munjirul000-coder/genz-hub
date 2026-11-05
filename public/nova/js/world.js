/* NOVA world monitor: local Natural Earth coastline outlines, live USGS data.
   Coastlines derived from world-atlas (license in /nova/world/). */
(() => {
  'use strict';
  function create(canvas, select) {
    const ctx = canvas.getContext('2d');
    let alive = true, frame, mode = 'globe', rotation = -0.45, dragX = null, lines = [], points = [], painted = [], w = 0, h = 0, dpr = 1;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rad = Math.PI / 180;
    const resize = () => { const box = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); w = box.width; h = box.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
    const project = (lon, lat) => {
      if (mode === 'map') return { x: (lon + 180) * w / 360, y: (90 - lat) * h / 180, visible: true };
      const a = lon * rad + rotation, b = lat * rad, R = Math.min(w, h) * .42;
      return { x: w / 2 + R * Math.cos(b) * Math.sin(a), y: h / 2 - R * Math.sin(b), visible: Math.cos(b) * Math.cos(a) >= 0 };
    };
    function line(pts) {
      ctx.beginPath(); let prev = null;
      for (const pt of pts) {
        const p = project(pt[0], pt[1]);
        if (!p.visible) { prev = null; continue; }
        if (!prev || (mode === 'map' && Math.abs(p.x - prev.x) > w / 2)) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }
    function draw() {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, w, h);
      if (mode === 'globe') {
        const R = Math.min(w, h) * .42, grad = ctx.createRadialGradient(w/2-R*.35, h/2-R*.4, 0, w/2, h/2, R);
        grad.addColorStop(0, '#253c61'); grad.addColorStop(.7, '#101e38'); grad.addColorStop(1, '#0a1221');
        ctx.fillStyle = grad; ctx.strokeStyle = '#79c9e888'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(w/2, h/2, R, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#8dc9df25'; ctx.lineWidth = .5;
      for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]));
      for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 91 }, (_, i) => [lon, -90 + i * 2]));
      ctx.strokeStyle = '#80b6cb'; ctx.lineWidth = .8; for (const arc of lines) line(arc);
      painted = []; for (const item of points) {
        const p = project(item.lon, item.lat); if (!p.visible) continue;
        const radius = Math.max(3, Math.min(9, 3 + item.magnitude)); painted.push({ ...p, item });
        ctx.fillStyle = '#ff756899'; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd2b8'; ctx.beginPath(); ctx.arc(p.x, p.y, radius / 2, 0, Math.PI * 2); ctx.fill();
      }
      if (mode === 'globe' && dragX === null && !reduced) rotation += .001;
      frame = requestAnimationFrame(draw);
    }
    canvas.addEventListener('pointerdown', e => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (dragX !== null && mode === 'globe') { rotation += (e.clientX - dragX) * .01; dragX = e.clientX; } });
    canvas.addEventListener('pointerup', e => { const box = canvas.getBoundingClientRect(), x = e.clientX-box.left, y = e.clientY-box.top; dragX = null; const nearest = painted.find(p => Math.hypot(p.x-x,p.y-y) < 12); if (nearest) select(nearest.item); });
    canvas.addEventListener('pointercancel', () => { dragX = null; });
    canvas.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); rotation += e.key === 'ArrowLeft' ? -.12 : .12; } });
    fetch('/nova/world/coastlines.json').then(r => { if (!r.ok) throw new Error('Coastline map unavailable'); return r.json(); }).then(data => { if (alive && Array.isArray(data)) lines = data; }).catch(() => { if (alive) select(null); });
    draw();
    return { setMode(value) { mode = value === 'map' ? 'map' : 'globe'; }, setPoints(value) { points = value || []; }, destroy() { alive = false; cancelAnimationFrame(frame); ro.disconnect(); } };
  }
  window.NovaWorld = { create };
})();
