/* NOVA world monitor. Coastline outlines: Natural Earth / world-atlas.
   Only USGS feed entries are interactive event markers; stars, grids and
   orbital lines are decorative and do not represent live events. */
(() => {
  'use strict';
  function create(canvas, select) {
    const ctx = canvas.getContext('2d');
    let alive = true, frame = 0, mode = 'globe', rotation = 1.18, dragX = null, dragged = false;
    let lines = [], landDots = [], points = [], painted = [], w = 0, h = 0, dpr = 1, lastDraw = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, rad = Math.PI / 180;
    let seed = 7181;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const stars = Array.from({ length: 95 }, () => ({ x: random(), y: random(), size: .3 + random() * 1.1, alpha: .12 + random() * .36 }));
    const radius = () => Math.min(w * .37, h * .39);
    function resize() {
      const box = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      w = box.width; h = box.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); invalidate();
    }
    function project(lon, lat) {
      if (mode === 'map') return { x: (lon + 180) * w / 360, y: (90 - lat) * h / 180, visible: true };
      const a = lon * rad + rotation, b = lat * rad, R = radius();
      return { x: w / 2 + R * Math.cos(b) * Math.sin(a), y: h / 2 - R * Math.sin(b), visible: Math.cos(b) * Math.cos(a) >= 0 };
    }
    // Append a projected polyline to the current path without connecting across
    // the back of the sphere or the map's antimeridian.
    function appendLine(pts) {
      let prev = null;
      for (const pt of pts) {
        const p = project(pt[0], pt[1]);
        if (!p.visible) { prev = null; continue; }
        if (!prev || (mode === 'map' && Math.abs(p.x - prev.x) > w / 2)) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        prev = p;
      }
    }
    function drawBackground() {
      ctx.fillStyle = '#020914'; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * .5, h * .52, 0, w * .5, h * .52, Math.max(w, h) * .62);
      glow.addColorStop(0, '#073860'); glow.addColorStop(.43, '#061a30'); glow.addColorStop(1, '#020712');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      for (const star of stars) { ctx.fillStyle = `rgba(139,217,255,${star.alpha})`; ctx.fillRect(star.x * w, star.y * h, star.size, star.size); }
      ctx.strokeStyle = 'rgba(65,163,218,.07)'; ctx.lineWidth = .7;
      for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }
    function drawGlobe() {
      const R = radius(), cx = w / 2, cy = h / 2;
      // Decorative orbital rings, behind the real geographical projection.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.26); ctx.strokeStyle = 'rgba(71,183,241,.23)'; ctx.lineWidth = .7;
      ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.24, R * .5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(.76); ctx.strokeStyle = 'rgba(71,183,241,.11)'; ctx.setLineDash([]); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.14, R * .61, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const aura = ctx.createRadialGradient(cx, cy, R * .8, cx, cy, R * 1.28);
      aura.addColorStop(0, 'rgba(17,155,238,.15)'); aura.addColorStop(.54, 'rgba(22,155,239,.15)'); aura.addColorStop(1, 'rgba(2,12,25,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2); ctx.fill();
      const ocean = ctx.createRadialGradient(cx - R * .32, cy - R * .43, R * .04, cx, cy, R * 1.05);
      ocean.addColorStop(0, '#0d5b91'); ocean.addColorStop(.42, '#08345b'); ocean.addColorStop(.8, '#061c36'); ocean.addColorStop(1, '#020e21');
      ctx.fillStyle = ocean; ctx.shadowColor = 'rgba(23,176,255,.48)'; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(105,218,255,.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(35,151,222,.30)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.stroke();
      // Blue light at the base is decorative, not an event marker.
      const beam = ctx.createLinearGradient(cx, cy + R * .8, cx, h);
      beam.addColorStop(0, 'rgba(37,187,255,0)'); beam.addColorStop(.65, 'rgba(30,165,247,.16)'); beam.addColorStop(1, 'rgba(20,103,202,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(cx - R * .08, cy + R * .8); ctx.lineTo(cx + R * .08, cy + R * .8); ctx.lineTo(cx + R * .45, h); ctx.lineTo(cx - R * .45, h); ctx.closePath(); ctx.fill();
    }
    // Sample the existing Natural Earth polygons into a subtle land texture.
    // These are decorative geography, never earthquake or activity markers.
    function makeLandDots(arcs) {
      const polygons = arcs.filter(a => a.length >= 4).map(vertices => {
        let minX = 180, maxX = -180, minY = 90, maxY = -90;
        for (const [x, y] of vertices) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        return { vertices, minX, maxX, minY, maxY };
      });
      function inside(x, y, v) {
        let hit = false;
        for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
          const [xi, yi] = v[i], [xj, yj] = v[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
        }
        return hit;
      }
      const result = []; let index = 0;
      for (let y = -78; y <= 82; y += 2.25) for (let x = -179; x < 180; x += 2.25) {
        const lon = x + Math.sin(index * 1.71) * .35, lat = y + Math.cos(index++ * 1.27) * .35;
        if (polygons.some(p => lon >= p.minX && lon <= p.maxX && lat >= p.minY && lat <= p.maxY && inside(lon, lat, p.vertices))) result.push([lon, lat]);
      }
      return result;
    }
    function drawContours() {
      ctx.lineWidth = .55; ctx.strokeStyle = mode === 'globe' ? 'rgba(70,190,246,.26)' : 'rgba(70,190,246,.18)'; ctx.beginPath();
      for (let lat = -75; lat <= 75; lat += 15) appendLine(Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]));
      for (let lon = -180; lon < 180; lon += 15) appendLine(Array.from({ length: 91 }, (_, i) => [lon, -90 + i * 2]));
      ctx.stroke();
      ctx.beginPath(); for (const arc of lines) appendLine(arc);
      ctx.strokeStyle = '#40bdff'; ctx.lineWidth = 1.05; ctx.shadowColor = '#12a7ff'; ctx.shadowBlur = mode === 'globe' ? 7 : 3; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(175,235,255,.65)'; ctx.lineWidth = .45; ctx.stroke();
      ctx.fillStyle = mode === 'globe' ? 'rgba(91,207,255,.48)' : 'rgba(91,207,255,.38)';
      for (const dot of landDots) { const p = project(dot[0], dot[1]); if (p.visible) ctx.fillRect(p.x, p.y, 1.15, 1.15); }
      // Small dots follow actual coastline geometry; they are decoration only.
      ctx.fillStyle = 'rgba(110,220,255,.5)';
      for (const arc of lines) for (let i = 0; i < arc.length; i += 9) { const p = project(arc[i][0], arc[i][1]); if (p.visible) ctx.fillRect(p.x, p.y, 1.1, 1.1); }
    }
    function drawEvents() {
      painted = [];
      for (const item of points) {
        const p = project(item.lon, item.lat); if (!p.visible) continue;
        const r = Math.max(3, Math.min(9, 3 + item.magnitude)); painted.push({ ...p, item });
        ctx.strokeStyle = 'rgba(255,141,119,.65)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowColor = '#ff8c72'; ctx.shadowBlur = 9; ctx.fillStyle = '#ff9f89'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, r / 2), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    function draw(now = 0) {
      if (!alive || !w || !h) return;
      if (!reduced && now && now - lastDraw < 30) { frame = requestAnimationFrame(draw); return; }
      lastDraw = now; ctx.clearRect(0, 0, w, h); drawBackground(); if (mode === 'globe') drawGlobe();
      drawContours(); drawEvents();
      if (mode === 'globe' && dragX === null && !reduced) rotation += .0015;
      if (!reduced) frame = requestAnimationFrame(draw);
    }
    function invalidate() { if (reduced && alive) { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); } }
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
    canvas.addEventListener('pointerdown', e => { dragX = e.clientX; dragged = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (dragX !== null && mode === 'globe') { const diff = e.clientX - dragX; if (Math.abs(diff) > 1) dragged = true; rotation += diff * .01; dragX = e.clientX; invalidate(); } });
    canvas.addEventListener('pointerup', e => { const box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top; dragX = null; if (!dragged) { const nearest = painted.find(p => Math.hypot(p.x - x, p.y - y) < 12); if (nearest) select(nearest.item); } });
    canvas.addEventListener('pointercancel', () => { dragX = null; });
    canvas.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); rotation += e.key === 'ArrowLeft' ? -.12 : .12; invalidate(); } });
    fetch('/nova/world/coastlines.json').then(r => { if (!r.ok) throw new Error('Coastline map unavailable'); return r.json(); }).then(data => { if (alive && Array.isArray(data)) { lines = data; landDots = makeLandDots(data); invalidate(); } }).catch(() => { if (alive) select(null); });
    if (!reduced) frame = requestAnimationFrame(draw);
    return { setMode(value) { mode = value === 'map' ? 'map' : 'globe'; invalidate(); }, setPoints(value) { points = value || []; invalidate(); }, destroy() { alive = false; cancelAnimationFrame(frame); ro.disconnect(); } };
  }
  window.NovaWorld = { create };
})();
