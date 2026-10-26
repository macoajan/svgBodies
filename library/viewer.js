// Free-camera viewer for library/poses.json.
// Projects the sampled 3D poses with any yaw/pitch and orders the shapes back to front
// (painter's algorithm) every frame, so it works from any angle. No dependencies.
//   const fig = PoseViewer.mount(svgElement, exerciseData, { yaw: 40, pitch: 30 });
//   fig.render(timeInSeconds);
// yaw 0 = side view (right side towards the camera), 90 = front view; pitch = elevation.
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#C2410C', IRON = '#0F2A3D', PLATE_FILL = '#DCE4EA', FLOOR_FILL = '#E2EAEF';
  const BOX_FILL = { top: '#EEF2F5', side: '#C9D3DB', front: '#DCE4EA' };
  const ANKLE_Y = 58, GROUND = 60.5, FLOOR_TOP = 59.9, HEAD_R = 4.5, PLATE_R = 6.5, PLATE_W = 2.2, KB_BELL = 7.2, KB_R = 4.2;
  const FOOT = 6, HEEL = 2;
  const SIDE_J = ['hip', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'hand'];
  const rad = d => d * Math.PI / 180;
  const f2 = v => v.toFixed(2);

  function node(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function camera(yaw, pitch, x0) {
    const cy = Math.cos(rad(yaw)), sy = Math.sin(rad(yaw)), cp = Math.cos(rad(pitch)), sp = Math.sin(rad(pitch));
    const horiz = q => (q.x - x0) * sy + q.z * cy;
    // Towards the camera: horizontally by the yaw, and upwards as the camera rises.
    const depth = q => horiz(q) * cp + (ANKLE_Y - q.y) * sp;
    const dir = (dx, dy, dz) => ({ x: dx * cy - dz * sy, y: dy * cp + (dx * sy + dz * cy) * sp });
    const proj = q => ({ x: 32 + (q.x - x0) * cy - q.z * sy, y: 54 + (q.y - ANKLE_Y) * cp + horiz(q) * sp, d: depth(q) });
    return { dir, proj, depth, cy, sy, pitch };
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
  const ptsAttr = list => list.map(q => `${f2(q.x)},${f2(q.y)}`).join(' ');

  const lerp3 = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

  function poseAt(ex, t) {
    const F = ex.frames, T = ex.duration;
    t = ((t % T) + T) % T;
    let i = 0;
    while (i < F.length - 2 && F[i + 1].t <= t) i++;
    const a = F[i], b = F[i + 1], k = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
    const J = {};
    for (const j of ['pelvis', 'shoulderC', 'neckTop', 'head']) J[j] = lerp3(a.joints[j], b.joints[j], k);
    for (const s of ['r', 'l']) { J[s] = {}; for (const j of SIDE_J) J[s][j] = lerp3(a.joints[s][j], b.joints[s][j], k); }
    const objects = a.objects.map((o, n) => ({
      type: o.type, at: lerp3(o.at, b.objects[n].at, k),
      phi: o.phi === undefined ? 0 : o.phi + (b.objects[n].phi - o.phi) * k,
    }));
    return { J, objects };
  }

  function mount(svg, ex, opts = {}) {
    const cam0 = ex.camera || { yaw: 40, pitch: 30 };
    const state = { yaw: opts.yaw ?? cam0.yaw, pitch: opts.pitch ?? cam0.pitch };
    const x0 = ex.centre;
    const back = node('g', {}, svg);     // floor and props, rebuilt when the camera moves
    const layer = node('g', {}, svg);
    const items = [];
    // Each item: a shape plus update(pose, cam) that positions it and returns its depth.
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

    for (const s of ['r', 'l']) {
      const J = j => p => p.J[s][j];
      const heel = p => { const a = p.J[s].ankle, t = p.J[s].toe, k = HEEL / FOOT; return { x: a.x + (a.x - t.x) * k, y: a.y + (a.y - t.y) * k, z: a.z + (a.z - t.z) * k }; };
      seg(heel, J('toe'));
      seg(J('knee'), J('ankle'));
      seg(J('hip'), J('knee'));
      seg(J('shoulder'), J('elbow'));
      seg(J('elbow'), J('hand'));
      for (const j of ['knee', 'elbow', 'hand']) dot(J(j));
    }
    seg(p => p.J.l.hip, p => p.J.r.hip);
    seg(p => p.J.shoulderC, p => p.J.pelvis);
    seg(p => p.J.neckTop, p => p.J.shoulderC);
    seg(p => p.J.l.shoulder, p => p.J.r.shoulder);
    disc(p => p.J.head, HEAD_R, {}, 0.2);

    ex.frames[0].objects.forEach((o, n) => {
      if (o.type === 'barbell') {
        for (const s of [1, -1]) {
          seg(p => ({ ...p.objects[n].at, z: 0 }), p => ({ ...p.objects[n].at, z: 30 * s }), { stroke: IRON, 'stroke-width': 2 });
          // Plate: a short cylinder along z; its outline is the hull of both faces.
          const body = node('polygon', { fill: PLATE_FILL, stroke: IRON, 'stroke-width': PLATE_W, 'stroke-linejoin': 'round' }, layer);
          items.push({ e: body, update: (p, c) => {
            const at = p.objects[n].at, P = [];
            for (const z of [23.4, 27]) for (let k = 0; k < 24; k++) {
              const a = k * Math.PI / 12;
              P.push(c.proj({ x: at.x + PLATE_R * Math.cos(a), y: at.y + PLATE_R * Math.sin(a), z: z * s }));
            }
            body.setAttribute('points', ptsAttr(hull(P)));
            return c.depth({ ...at, z: 25.2 * s });
          } });
          disc(p => ({ ...p.objects[n].at, z: 27 * s }), 1.4, { fill: IRON, stroke: 'none' }, 0.03);
        }
      } else {
        disc(p => {
          const o2 = p.objects[n], ph = rad(o2.phi);
          return { x: o2.at.x + KB_BELL * Math.sin(ph), y: o2.at.y + KB_BELL * Math.cos(ph), z: o2.at.z };
        }, KB_R, { fill: IRON, stroke: 'none' });
      }
    });

    // Floor and props depend only on the camera.
    let lastCam = '';
    function drawBack(c) {
      const key = `${state.yaw}|${state.pitch}`;
      if (key === lastCam) return;
      lastCam = key;
      back.textContent = '';
      const lo = ex.extent ? ex.extent.lo : x0 - 17, hi = ex.extent ? ex.extent.hi : x0 + 17;
      const gx = Math.max(17, (hi - lo) / 2 + 3), gz = 17;
      node('polygon', { points: ptsAttr([[-gx, -gz], [gx, -gz], [gx, gz], [-gx, gz]].map(([dx, dz]) => c.proj({ x: x0 + dx, y: GROUND, z: dz }))), fill: FLOOR_FILL, stroke: 'none' }, back);
      for (const pr of ex.props || []) {
        if (pr.type === 'box') {
          const P = (x, y, z) => c.proj({ x, y, z }), y1 = FLOOR_TOP, { x0: a, x1: b, top, hz } = pr;
          const faces = [];
          // Visible faces of the box for this camera (normal towards the viewer).
          if (c.cy > 0.01) faces.push([BOX_FILL.side, [P(a, top, hz), P(b, top, hz), P(b, y1, hz), P(a, y1, hz)]]);
          if (c.cy < -0.01) faces.push([BOX_FILL.side, [P(a, top, -hz), P(b, top, -hz), P(b, y1, -hz), P(a, y1, -hz)]]);
          if (c.sy > 0.01) faces.push([BOX_FILL.front, [P(b, top, -hz), P(b, top, hz), P(b, y1, hz), P(b, y1, -hz)]]);
          if (c.sy < -0.01) faces.push([BOX_FILL.front, [P(a, top, -hz), P(a, top, hz), P(a, y1, hz), P(a, y1, -hz)]]);
          if (c.pitch > 0.5) faces.push([BOX_FILL.top, [P(a, top, -hz), P(b, top, -hz), P(b, top, hz), P(a, top, hz)]]);
          for (const [fill, q] of faces) node('polygon', { points: ptsAttr(q), fill, stroke: IRON, 'stroke-width': 1.2 }, back);
        } else if (pr.type === 'pullbar') {
          const A1 = c.proj({ x: pr.x, y: pr.y, z: -pr.hz }), B1 = c.proj({ x: pr.x, y: pr.y, z: pr.hz });
          node('line', { x1: f2(A1.x), y1: f2(A1.y), x2: f2(B1.x), y2: f2(B1.y), stroke: IRON, 'stroke-width': 2.4 }, back);
        }
      }
    }

    let order = [];
    function render(t) {
      const c = camera(state.yaw, state.pitch, x0), p = poseAt(ex, t);
      drawBack(c);
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
      state.pitch = Math.max(-5, Math.min(89, drag.pitch + (e.clientY - drag.y) * 0.4));
    });
    const end = () => { drag = null; svg.style.cursor = 'grab'; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('dblclick', () => Object.assign(state, home));

    return { render, state };
  }

  global.PoseViewer = { mount, poseAt };
})(typeof window !== 'undefined' ? window : globalThis);
