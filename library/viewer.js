// Free-camera viewer for library/poses.json.
// Projects the sampled 3D poses with any yaw/pitch and orders the shapes back to front
// (painter's algorithm) every frame, so it works from any angle. No dependencies.
//   const fig = PoseViewer.mount(svgElement, exerciseData, { yaw: 40, pitch: 30 });
//   fig.render(timeInSeconds);
// yaw 0 = side view, 90 = front view; pitch = camera elevation.
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#C2410C', IRON = '#0F2A3D', PLATE_FILL = '#DCE4EA', FLOOR_FILL = '#E2EAEF';
  const A = 28, ANKLE_Y = 58, GROUND = 60.5, HEAD_R = 4.5, PLATE_R = 6.5, PLATE_W = 2.2, KB_BELL = 7.2, KB_R = 4.2;
  const rad = d => d * Math.PI / 180;

  function node(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f2 = v => v.toFixed(2);

  function camera(yaw, pitch) {
    const cy = Math.cos(rad(yaw)), sy = Math.sin(rad(yaw)), cp = Math.cos(rad(pitch)), sp = Math.sin(rad(pitch));
    // Direction vector in screen space; d = depth (larger = nearer the viewer).
    const dir = (dx, dy, dz) => { const d = dx * sy + dz * cy; return { x: dx * cy - dz * sy, y: dy * cp + d * sp, d }; };
    const proj = q => { const r = dir(q.x - A - 2, q.y - ANKLE_Y, q.z); return { x: 32 + r.x, y: 54 + r.y, d: r.d }; };
    return { dir, proj };
  }

  // Convex hull (monotone chain) of 2D points.
  function hull(pts) {
    const P = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], hi = [];
    for (const q of P) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of P.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }

  function lerp3(a, b, k) { return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; }

  function poseAt(ex, t) {
    const F = ex.frames, T = ex.duration;
    t = ((t % T) + T) % T;
    let i = 0;
    while (i < F.length - 2 && F[i + 1].t <= t) i++;
    const a = F[i], b = F[i + 1], k = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
    const joints = {};
    for (const j in a.joints) joints[j] = lerp3(a.joints[j], b.joints[j], k);
    const objects = a.objects.map((o, n) => ({
      type: o.type, at: lerp3(o.at, b.objects[n].at, k),
      phi: o.phi === undefined ? 0 : o.phi + (b.objects[n].phi - o.phi) * k,
    }));
    return { joints, objects };
  }

  function mount(svg, ex, opts = {}) {
    const state = { yaw: opts.yaw ?? 40, pitch: opts.pitch ?? 30 };
    const floor = node('polygon', { fill: FLOOR_FILL, stroke: 'none' }, svg);
    const layer = node('g', {}, svg);
    const items = [];
    // Each item: a shape plus update(pose, cam) that positions it and returns its depth.
    const J = (p, j, s) => { const q = p.joints[j]; return { x: q.x, y: q.y, z: s * q.z }; };
    const seg = (getP, getQ, attrs = {}) => {
      const e = node('line', attrs, layer);
      items.push({ e, update: (p, c) => {
        const P = c.proj(getP(p)), Q = c.proj(getQ(p));
        e.setAttribute('x1', f2(P.x)); e.setAttribute('y1', f2(P.y)); e.setAttribute('x2', f2(Q.x)); e.setAttribute('y2', f2(Q.y));
        return (P.d + Q.d) / 2;
      } });
    };
    const disc = (get, r, attrs, bias = 0) => {
      const e = node('circle', { r, ...attrs }, layer);
      items.push({ e, update: (p, c) => { const P = c.proj(get(p)); e.setAttribute('cx', f2(P.x)); e.setAttribute('cy', f2(P.y)); return P.d + bias; } });
    };
    const dot = get => disc(get, 1.7, { fill: INK, stroke: 'none' }, 0.05);

    for (const s of [1, -1]) {
      const stance = ex.frames[0].joints.ankle.z;
      seg(() => ({ x: A - 2, y: ANKLE_Y, z: s * stance }), () => ({ x: A + 6, y: ANKLE_Y, z: s * stance }));
      seg(p => J(p, 'knee', s), p => J(p, 'ankle', s));
      seg(p => J(p, 'hip', s), p => J(p, 'knee', s));
      seg(p => J(p, 'shoulder', s), p => J(p, 'elbow', s));
      seg(p => J(p, 'elbow', s), p => J(p, 'hand', s));
      for (const j of ['knee', 'elbow', 'hand']) dot(p => J(p, j, s));
    }
    seg(p => J(p, 'hip', -1), p => J(p, 'hip', 1));
    seg(p => J(p, 'shoulder', -1), p => J(p, 'shoulder', 1));
    seg(p => ({ ...p.joints.neckTop, z: 0 }), p => ({ ...p.joints.hip, z: 0 }));
    disc(p => p.joints.head, HEAD_R, {});

    ex.frames[0].objects.forEach((o, n) => {
      if (o.type === 'barbell') {
        for (const s of [1, -1]) {
          seg(p => ({ ...p.objects[n].at, z: 0 }), p => ({ ...p.objects[n].at, z: 30 * s }), { stroke: IRON, 'stroke-width': 2 });
          // Plate: a short cylinder along z. Its outline is the convex hull of both faces, so it
          // keeps its thickness when seen edge-on; the outer face is drawn on top.
          const body = node('polygon', { fill: PLATE_FILL, stroke: IRON, 'stroke-width': PLATE_W, 'stroke-linejoin': 'round' }, layer);
          items.push({ e: body, update: (p, c) => {
            const at = p.objects[n].at, pts = [];
            for (const z of [23.4, 27]) for (let k = 0; k < 24; k++) {
              const a = k * Math.PI / 12;
              pts.push(c.proj({ x: at.x + PLATE_R * Math.cos(a), y: at.y + PLATE_R * Math.sin(a), z: z * s }));
            }
            body.setAttribute('points', hull(pts).map(q => `${f2(q.x)},${f2(q.y)}`).join(' '));
            return c.proj({ ...at, z: 25.2 * s }).d;
          } });
          disc(p => ({ ...p.objects[n].at, z: 27 * s }), 1.4, { fill: IRON, stroke: 'none' }, 0.03);
        }
      } else {
        disc(p => {
          const o2 = p.objects[n], ph = rad(o2.phi);
          return { x: o2.at.x + KB_BELL * Math.sin(ph), y: o2.at.y + KB_BELL * Math.cos(ph), z: 0 };
        }, KB_R, { fill: IRON, stroke: 'none' });
      }
    });

    let order = [];
    function render(t) {
      const c = camera(state.yaw, state.pitch), p = poseAt(ex, t);
      const g = 17;
      floor.setAttribute('points', [[-g, -g], [g, -g], [g, g], [-g, g]]
        .map(([dx, dz]) => c.proj({ x: A + 2 + dx, y: GROUND, z: dz })).map(q => `${f2(q.x)},${f2(q.y)}`).join(' '));
      const depth = items.map(it => it.update(p, c));
      const next = items.map((_, i) => i).sort((a, b) => depth[a] - depth[b]);
      if (next.some((v, i) => v !== order[i])) { next.forEach(i => layer.appendChild(items[i].e)); order = next; }
    }

    // Drag to orbit; double click returns to the initial camera.
    const home = { ...state };
    let drag = null;
    svg.style.touchAction = 'none';
    svg.style.cursor = 'grab';
    svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ...state }; svg.setPointerCapture(e.pointerId); svg.style.cursor = 'grabbing'; });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      state.yaw = drag.yaw + (e.clientX - drag.x) * 0.6;
      state.pitch = Math.max(-5, Math.min(70, drag.pitch + (e.clientY - drag.y) * 0.4));
    });
    const end = () => { drag = null; svg.style.cursor = 'grab'; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('dblclick', () => Object.assign(state, home));

    return { render, state };
  }

  global.PoseViewer = { mount, poseAt };
})(typeof window !== 'undefined' ? window : globalThis);
