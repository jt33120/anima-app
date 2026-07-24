"use client";

/*
 * arbre-vivant.tsx — L'arbre ANCRÉ du monde, rendu Canvas 2D procédural. Adaptateur MUET
 * (AD-7) : il DESSINE un niveau d'éveil (0→100) reçu du modèle ; il ne le calcule pas. La
 * monotonie de la croissance (l'arbre ne régresse pas — AD-8) est garantie côté modèle.
 * 100 % procédural (aucun asset externe), aucun secret, aucun accès base.
 *
 * Asset « Arbre Pomme Magique » (Claude Design) porté depuis le prototype DC, ré-habillé
 * aux tokens Nuit galactique, dépouillé de son slider/pastilles (« on ne note personne »).
 *
 * PERF / A11Y : rendu STATIQUE par défaut (un dessin par valeur d'éveil) → sobre en
 * batterie et sans mouvement (prefers-reduced-motion satisfait par construction). La vie
 * ambiante (balancement, halo pulsé) reste un ajout futur optionnel (passer un `time`
 * animé via requestAnimationFrame), à décider selon le compromis batterie/immersion.
 */

import { useEffect, useRef } from "react";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (x: number) => x * x * (3 - 2 * x);
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
function mulberry(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number; w: number; a: number; nx: number; ny: number; dx: number; dy: number };
type Striae = { o: number; tone: number; wf: number; ph: number; al: number };
interface Seg { pts: Pt[]; depth: number; s: number; e: number; kind: string; striae?: Striae[] }
interface Terminal { x: number; y: number; thr: number; r: number; v: number; ph: number; blossom: boolean; sc0: number }
interface Joint { x: number; y: number; r: number; after: number }
interface Tuft { canvas: HTMLCanvasElement; R: number }
interface Mote { rad: number; spd: number; ph: number; size: number }
interface Crown { cx: number; cy: number; rx: number; ry: number }
type GenOpts = { curv?: number; taperPow?: number; flare?: boolean; toward?: number; towardK?: number; root?: boolean; kind?: string };

class MoteurArbre {
  private canvas: HTMLCanvasElement;
  private light = { x: -0.5, y: -0.83 };
  private W = 1408;
  private H = 860;
  private dpr = 1;
  private ctx!: CanvasRenderingContext2D;
  private wood!: HTMLCanvasElement;
  private wctx!: CanvasRenderingContext2D;
  private segs: Seg[] = [];
  private joints: Joint[] = [];
  private terminals: Terminal[] = [];
  private tufts: Tuft[] = [];
  private motes: Mote[] = [];
  private crown: Crown | null = null;
  private ax = 704;
  private ay = 402;
  private baseY = 752;
  private built = false;
  private woodT: number | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  private leafShade(lit: number): string {
    lit = clamp(lit, 0, 1);
    const st = [[70, 84, 120], [104, 148, 196], [143, 182, 216], [205, 228, 248]];
    const seg = lit * 3, i = Math.min(2, Math.floor(seg)), f = seg - i, a = st[i], b = st[i + 1];
    return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
  }

  build(): void {
    if (this.built) return;
    this.built = true;
    const c = this.canvas;
    const dpr = this.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = this.W * dpr; c.height = this.H * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    this.ctx = ctx; this.ctx.scale(dpr, dpr);
    this.wood = document.createElement("canvas");
    this.wood.width = this.W * dpr; this.wood.height = this.H * dpr;
    const wctx = this.wood.getContext("2d");
    if (!wctx) return;
    this.wctx = wctx; this.wctx.scale(dpr, dpr);

    const rng = mulberry(23);
    const cx = 704, baseY = this.baseY = 752;
    this.segs = []; this.joints = []; this.terminals = [];
    this.ax = cx; this.ay = 402;

    const gen = (x: number, y: number, ang: number, len: number, wBase: number, wTip: number, depth: number, sStart: number, opts: GenOpts = {}): Seg => {
      const steps = Math.max(4, Math.round(len / 22));
      const pts: Pt[] = [];
      let a = ang, px = x, py = y;
      const curv = opts.curv != null ? opts.curv : 0.1 + rng() * 0.07;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        let w = wTip + (wBase - wTip) * Math.pow(1 - u, opts.taperPow || 1.15);
        if (opts.flare) w += wBase * 1.3 * Math.exp(-u * 5.0);
        pts.push({ x: px, y: py, w, a, nx: 0, ny: 0, dx: 0, dy: 0 });
        if (i === steps) break;
        a += (rng() - 0.5) * curv * 2;
        if (opts.toward != null) a += (opts.toward - a) * (opts.towardK || 0.1);
        if (!opts.root && depth >= 1) a = Math.max(-Math.PI + 0.24, Math.min(-0.2, a));
        const seg = len / steps;
        px += Math.cos(a) * seg; py += Math.sin(a) * seg;
      }
      const s = sStart, e = Math.min(0.62, s + (depth === 0 ? 0.1 : 0.085));
      const bo: Seg = { pts, depth, s, e, kind: opts.kind || "branch" };
      if (wBase > 18 || opts.kind === "trunk") {
        bo.striae = [];
        const nS = Math.round(3 + wBase / 10);
        for (let k = 0; k < nS; k++) bo.striae.push({ o: rng() * 1.5 - 0.75, tone: rng() < 0.5 ? 1 : -1, wf: 0.05 + rng() * 0.08, ph: rng() * 6.28, al: 0.1 + rng() * 0.15 });
      }
      this.segs.push(bo);
      if (opts.root || opts.kind === "trunk" || opts.kind === "buttress") return bo;
      const tip = pts[pts.length - 1];
      if (wTip <= 3.8 || depth >= 7) {
        this.terminals.push({ x: tip.x, y: tip.y, thr: Math.min(0.78, e + 0.02 + rng() * 0.06), r: 46 + rng() * 28, v: this.terminals.length % 6, ph: rng() * 6.28, blossom: rng() < 0.34, sc0: 0.98 + rng() * 0.38 });
        return bo;
      }
      const n = depth <= 2 && rng() < 0.22 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        let na = tip.a + off * (0.54 + rng() * 0.22) + (rng() - 0.5) * 0.12;
        na = Math.max(-Math.PI + 0.24, Math.min(-0.2, na));
        const cw = tip.w * (n === 2 ? 0.76 : 0.64) * (0.92 + rng() * 0.16);
        if (tip.w > 14) this.joints.push({ x: tip.x, y: tip.y, r: tip.w * 1.0, after: e + 0.04 });
        gen(tip.x, tip.y, na, len * (0.74 + rng() * 0.14), cw, cw * 0.5, depth + 1, e - 0.015, { toward: -Math.PI / 2, towardK: 0.02 });
      }
      if (depth >= 2 && depth <= 3) {
        for (let i = 2; i < pts.length - 1; i++) {
          const u = i / (pts.length - 1);
          if (u < 0.35 || u > 0.8 || rng() > 0.12) continue;
          const p = pts[i], side = rng() < 0.5 ? 1 : -1;
          let na = p.a + side * (0.6 + rng() * 0.3);
          na = Math.max(-Math.PI + 0.2, Math.min(-0.15, na));
          gen(p.x, p.y, na, len * 0.4, p.w * 0.5, p.w * 0.22, depth + 2, Math.min(0.6, e + 0.05), { toward: -Math.PI / 2, towardK: 0.03 });
        }
      }
      return bo;
    };

    const rootDefs = [
      [-48, 0.98, 236, 46], [-28, 0.68, 176, 36], [-11, 0.4, 122, 26],
      [11, 0.4, 120, 26], [28, 0.68, 174, 36], [48, 0.98, 232, 46],
    ];
    rootDefs.forEach((r) => {
      const dir = r[0] > 0 ? 1 : -1;
      const oy = baseY - 34 - Math.abs(r[0]) * 0.12;
      const b = gen(cx + r[0] * 0.5, oy, Math.PI / 2 - dir * r[1], r[2], r[3], 3, 0, 0, { root: true, kind: "root", curv: 0.045, taperPow: 1.55, toward: dir > 0 ? 0.5 : Math.PI - 0.5, towardK: 0.1 });
      if (Math.abs(r[0]) > 20) {
        const mp = b.pts[Math.floor(b.pts.length * 0.52)];
        gen(mp.x, mp.y, Math.PI / 2 - dir * 0.62, r[2] * 0.4, mp.w * 0.52, 2, 0, 0, { root: true, kind: "root", curv: 0.06, taperPow: 1.5, toward: dir > 0 ? 0.7 : Math.PI - 0.7, towardK: 0.1 });
      }
    });

    const trunk = gen(cx, baseY - 4, -Math.PI / 2 + 0.015, 256, 64, 40, 0, 0, { kind: "trunk", curv: 0.035, flare: true, taperPow: 1.12, toward: -Math.PI / 2, towardK: 0.15 });
    const fork = trunk.pts[trunk.pts.length - 1];
    this.ax = fork.x; this.ay = fork.y - 96;

    const mains = [[-1.4, 23, 168], [-1.02, 26, 196], [-0.62, 30, 210], [-0.2, 33, 176], [0.2, 33, 174], [0.62, 30, 208], [1.02, 26, 194], [1.4, 23, 166]];
    mains.forEach((m) => {
      this.joints.push({ x: fork.x, y: fork.y, r: 42, after: 0.13 });
      gen(fork.x, fork.y, -Math.PI / 2 + m[0], m[2], m[1], m[1] * 0.5, 1, 0.1, { toward: -Math.PI / 2, towardK: 0.026 });
    });

    this.terminals = this.terminals.filter((tm) => {
      const dx = (tm.x - this.ax) / 140, dy = (tm.y - this.ay) / 118;
      return dx * dx + dy * dy > 1;
    });
    this.terminals.sort((a, b) => a.y - b.y);

    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const tm of this.terminals) { if (tm.x < mnx) mnx = tm.x; if (tm.x > mxx) mxx = tm.x; if (tm.y < mny) mny = tm.y; if (tm.y > mxy) mxy = tm.y; }
    this.crown = { cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2 - 10, rx: (mxx - mnx) / 2 + 70, ry: (mxy - mny) / 2 + 55 };

    this.tufts = [];
    for (let i = 0; i < 6; i++) this.tufts.push(this.buildTuft(64, 100 + i * 17));

    this.motes = [];
    for (let i = 0; i < 7; i++) this.motes.push({ rad: 50 + rng() * 60, spd: 0.18 + rng() * 0.3, ph: rng() * 6.28, size: 1.4 + rng() * 1.6 });
  }

  private buildTuft(r: number, seed: number): Tuft {
    const rng = mulberry(seed);
    const pad = 10, R = r + pad;
    const s = document.createElement("canvas");
    s.width = s.height = Math.ceil(R * 2);
    const c = s.getContext("2d");
    if (!c) return { canvas: s, R };
    c.translate(R, R);
    for (let k = 0; k < 6; k++) {
      const bx = (rng() * 2 - 1) * r * 0.5 + r * 0.1, by = (rng() * 2 - 1) * r * 0.45 + r * 0.12, br = r * (0.4 + rng() * 0.24);
      const g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, "rgba(42,54,92,0.5)"); g.addColorStop(1, "rgba(42,54,92,0)");
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, 6.2832); c.fill();
    }
    const N = Math.round(r * 2.9);
    for (let j = 0; j < N; j++) {
      const a = rng() * 6.28, rr = Math.sqrt(rng()) * r;
      const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * 0.9;
      const lit = clamp(0.5 - (lx * 0.5 + ly * 0.83) / r * 0.62, 0, 1) * (0.78 + rng() * 0.32);
      c.save(); c.translate(lx, ly); c.rotate(rng() * Math.PI);
      c.fillStyle = this.leafShade(lit);
      const sz = 3.4 + rng() * 3.4;
      c.beginPath(); c.ellipse(0, 0, sz * 1.25, sz * 0.55, 0, 0, 6.2832); c.fill();
      if (lit > 0.6) { c.fillStyle = "rgba(236,244,252,0.42)"; c.beginPath(); c.ellipse(-sz * 0.25, -sz * 0.16, sz * 0.5, sz * 0.22, 0, 0, 6.2832); c.fill(); }
      c.restore();
    }
    const ao = c.createRadialGradient(r * 0.3, r * 0.34, 0, r * 0.3, r * 0.34, r);
    ao.addColorStop(0, "rgba(32,44,74,0.26)"); ao.addColorStop(1, "rgba(32,44,74,0)");
    c.fillStyle = ao; c.beginPath(); c.arc(r * 0.3, r * 0.34, r, 0, 6.2832); c.fill();
    c.fillStyle = "rgba(240,247,255,0.8)";
    for (let k = 0; k < Math.round(r * 0.15); k++) {
      const a = -2.2 + (rng() - 0.5) * 1.1, rr = r * (0.68 + rng() * 0.28);
      c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.9, 1.2 + rng() * 1.2, 0, 6.2832); c.fill();
    }
    return { canvas: s, R };
  }

  private visiblePts(b: Seg, g: number): Pt[] | null {
    const pts = b.pts, total = pts.length - 1, fEnd = total * g;
    const iEnd = Math.min(total, Math.floor(fEnd)), frac = fEnd - iEnd;
    const vp = pts.slice(0, iEnd + 1);
    if (frac > 0.02 && iEnd < total) {
      const a = pts[iEnd], d = pts[iEnd + 1];
      vp.push({ x: a.x + (d.x - a.x) * frac, y: a.y + (d.y - a.y) * frac, w: a.w + (d.w - a.w) * frac, a: a.a, nx: 0, ny: 0, dx: 0, dy: 0 });
    }
    return vp.length > 1 ? vp : null;
  }

  private paintBranch(ctx: CanvasRenderingContext2D, b: Seg, g: number): void {
    const vp = this.visiblePts(b, g);
    if (!vp) return;
    const L: { x: number; y: number }[] = [], R: { x: number; y: number }[] = [];
    for (let i = 0; i < vp.length; i++) {
      const p0 = vp[Math.max(0, i - 1)], p1 = vp[Math.min(vp.length - 1, i + 1)];
      let dx = p1.x - p0.x, dy = p1.y - p0.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const nx = -dy, ny = dx, h = Math.max(0.5, vp[i].w / 2);
      vp[i].nx = nx; vp[i].ny = ny; vp[i].dx = dx; vp[i].dy = dy;
      L.push({ x: vp[i].x + nx * h, y: vp[i].y + ny * h });
      R.push({ x: vp[i].x - nx * h, y: vp[i].y - ny * h });
    }
    const tip = vp[vp.length - 1], base = vp[0];
    const m = vp[Math.floor(vp.length / 2)];
    const side = (m.nx * this.light.x + m.ny * this.light.y) > 0 ? 1 : -1;
    const hw = Math.max(2, m.w / 2);
    if ((base.w + tip.w) / 2 >= 5) {
      const gr = ctx.createLinearGradient(m.x + m.nx * hw * side, m.y + m.ny * hw * side, m.x - m.nx * hw * side, m.y - m.ny * hw * side);
      gr.addColorStop(0, "#C9C5DE"); gr.addColorStop(0.42, "#9A96BE"); gr.addColorStop(1, "#6A6690");
      ctx.fillStyle = gr;
    } else ctx.fillStyle = "#8A86AE";
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i].x, L[i].y);
    ctx.quadraticCurveTo(tip.x + tip.dx * tip.w * 0.75, tip.y + tip.dy * tip.w * 0.75, R[R.length - 1].x, R[R.length - 1].y);
    for (let i = R.length - 2; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.quadraticCurveTo(base.x - base.dx * base.w * 0.6, base.y - base.dy * base.w * 0.6, L[0].x, L[0].y);
    ctx.closePath(); ctx.fill();

    const avgW = (base.w + tip.w) / 2;
    if (avgW >= 5 && b.kind !== "root") {
      const edge = (ofrac: number, color: string, wf: number) => {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, avgW * wf); ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < vp.length; i++) {
          const o = vp[i].w / 2 * ofrac;
          const X = vp[i].x + vp[i].nx * o * side, Y = vp[i].y + vp[i].ny * o * side;
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.stroke();
      };
      edge(0.55, "rgba(242,246,252,0.5)", 0.16);
      edge(-0.5, "rgba(42,38,72,0.5)", 0.2);
    } else if (avgW >= 5) {
      ctx.strokeStyle = "rgba(238,243,250,0.3)"; ctx.lineWidth = Math.max(0.8, avgW * 0.12); ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < vp.length; i++) { const o = vp[i].w / 2 * 0.5; const X = vp[i].x + vp[i].nx * o * side, Y = vp[i].y + vp[i].ny * o * side; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke();
    }
    if (b.striae) {
      for (const st of b.striae) {
        ctx.strokeStyle = st.tone > 0 ? `rgba(243,246,251,${st.al})` : `rgba(42,38,72,${st.al + 0.05})`;
        ctx.lineWidth = Math.max(0.8, avgW * st.wf); ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < vp.length; i++) {
          const u = i / (vp.length - 1);
          const o = vp[i].w / 2 * 0.85 * (st.o + Math.sin(u * 4.2 + st.ph) * 0.11);
          const X = vp[i].x + vp[i].nx * o, Y = vp[i].y + vp[i].ny * o;
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.stroke();
      }
    }
  }

  private drawWood(t: number): void {
    const ctx = this.wctx;
    ctx.clearRect(0, 0, this.W, this.H);
    const order: Record<string, number> = { root: 0, buttress: 1, trunk: 2, branch: 3 };
    const segs = this.segs.slice().sort((a, b) => (order[a.kind] - order[b.kind]) || (a.depth - b.depth));
    for (const b of segs) {
      let g: number;
      if (b.kind === "root") g = 0.3 + 0.7 * ramp(t, 0, 0.11);
      else if (b.kind === "trunk" || b.kind === "buttress") g = 0.32 + 0.68 * ramp(t, 0, 0.1);
      else g = ramp(t, b.s, b.e);
      if (g > 0.002) this.paintBranch(ctx, b, b.kind === "branch" ? ease(g) : g);
    }
    for (const j of this.joints) {
      if (t < j.after) continue;
      const a = Math.min(1, (t - j.after) / 0.1) * 0.2;
      const g = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, j.r);
      g.addColorStop(0, `rgba(42,38,72,${a})`); g.addColorStop(1, "rgba(42,38,72,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(j.x, j.y, j.r, 0, 6.2832); ctx.fill();
    }
  }

  private drawBud(ctx: CanvasRenderingContext2D, s: number, alpha: number): void {
    ctx.save(); ctx.globalAlpha = alpha; ctx.scale(s, s);
    const g = ctx.createLinearGradient(-0.5, -0.6, 0.5, 0.8);
    g.addColorStop(0, "#C3D6EC"); g.addColorStop(1, "#6E8CB6");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -0.7);
    ctx.bezierCurveTo(0.55, -0.35, 0.5, 0.5, 0, 0.8);
    ctx.bezierCurveTo(-0.5, 0.5, -0.55, -0.35, 0, -0.7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(90,120,150,0.7)"; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(0, -0.62); ctx.quadraticCurveTo(0.1, 0, 0, 0.72); ctx.stroke();
    ctx.fillStyle = "rgba(240,250,255,0.7)";
    ctx.beginPath(); ctx.ellipse(-0.18, -0.28, 0.12, 0.2, -0.4, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  private drawFlower(ctx: CanvasRenderingContext2D, s: number, open: number, fall: number, alpha: number): void {
    ctx.save(); ctx.globalAlpha = alpha;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5) + fall * 0.3;
      const d = s * (0.34 + 0.34 * open) + fall * s * 0.5;
      const px = Math.cos(a) * d, py = Math.sin(a) * d + fall * fall * s * 2.2;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2 + fall * (i % 2 ? 0.6 : -0.5));
      ctx.globalAlpha = alpha * (1 - fall * 0.75);
      const pg = ctx.createLinearGradient(0, -s * 0.45, 0, s * 0.2);
      pg.addColorStop(0, "#F6F9FD"); pg.addColorStop(1, "#CCDCEF");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.16, s * 0.26 * (0.5 + 0.5 * open), s * 0.4 * (0.5 + 0.5 * open), 0, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#F3E3AC";
    ctx.beginPath(); ctx.arc(0, 0, s * 0.16 * (0.6 + 0.4 * open), 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(180,150,90,0.8)";
    for (let i = 0; i < 6; i++) { const a = i * 1.047; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1, s * 0.03, 0, 6.2832); ctx.fill(); }
    ctx.restore();
  }

  private drawApple(ctx: CanvasRenderingContext2D, ripe: number): void {
    const g = ctx.createRadialGradient(-0.35, -0.42, 0.1, 0, 0, 1.55);
    g.addColorStop(0, "#EAF4FF"); g.addColorStop(0.28, "#CDE4F8"); g.addColorStop(0.6, "#8FC1EF"); g.addColorStop(0.85, "#5E86C0"); g.addColorStop(1, "#3E5C9A");
    ctx.fillStyle = g;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(0, -0.28);
      ctx.bezierCurveTo(-0.12, -0.95, -1.12, -0.72, -1.0, 0.06);
      ctx.bezierCurveTo(-0.94, 0.72, -0.4, 1.16, 0, 0.9);
      ctx.bezierCurveTo(0.4, 1.16, 0.94, 0.72, 1.0, 0.06);
      ctx.bezierCurveTo(1.12, -0.72, 0.12, -0.95, 0, -0.28);
      ctx.closePath();
    };
    body(); ctx.fill();
    ctx.save(); body(); ctx.clip();
    ctx.fillStyle = "rgba(30,40,90,0.35)";
    ctx.beginPath(); ctx.ellipse(0.14, 0.22, 0.58, 0.62, 0.2, 0, 6.2832); ctx.fill();
    const ca = ctx.createRadialGradient(0, 0.6, 0, 0, 0.6, 0.55);
    ca.addColorStop(0, "rgba(205,228,248,0.6)"); ca.addColorStop(1, "rgba(205,228,248,0)");
    ctx.fillStyle = ca; ctx.beginPath(); ctx.arc(0, 0.6, 0.55, 0, 6.2832); ctx.fill();
    if (ripe < 1) { ctx.fillStyle = `rgba(130,150,185,${(1 - ripe) * 0.4})`; body(); ctx.fill(); }
    ctx.restore();
    body(); ctx.strokeStyle = "rgba(205,228,248,0.6)"; ctx.lineWidth = 0.045; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath(); ctx.ellipse(-0.42, -0.44, 0.2, 0.32, -0.5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(-0.14, -0.64, 0.07, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.ellipse(0.36, 0.18, 0.1, 0.24, 0.5, 0, 6.2832); ctx.fill();
  }

  private drawStar(x: number, y: number, r: number, alpha: number, color: string): void {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y); ctx.fillStyle = color; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const rad = k % 2 ? r * 0.3 : r; const a = k * Math.PI / 4 - Math.PI / 2; const X = Math.cos(a) * rad, Y = Math.sin(a) * rad; if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /** Dessine l'arbre à l'éveil `t` (0→1). `time` anime la vie ambiante (0 = frame statique). */
  private draw(t: number, time: number): void {
    if (this.woodT === undefined || Math.abs(t - this.woodT) > 0.0009) { this.drawWood(t); this.woodT = t; }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save(); ctx.translate(704, this.baseY + 34); ctx.scale(1, 0.16);
    const gs = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
    gs.addColorStop(0, "rgba(8,6,22,.55)"); gs.addColorStop(0.6, "rgba(8,6,22,.28)"); gs.addColorStop(1, "rgba(8,6,22,0)");
    ctx.fillStyle = gs; ctx.beginPath(); ctx.arc(0, 0, 300, 0, 6.2832); ctx.fill(); ctx.restore();

    ctx.drawImage(this.wood, 0, 0, this.W, this.H);

    const flIn = ramp(t, 0.74, 0.79), flOut = ramp(t, 0.86, 0.92);
    const cr = this.crown;
    const cRev = ramp(t, 0.5, 0.86);
    if (cRev > 0.01 && cr) {
      ctx.save(); ctx.globalAlpha = 0.5 * cRev;
      const sh = ctx.createRadialGradient(cr.cx, cr.cy + cr.ry * 0.15, 0, cr.cx, cr.cy + cr.ry * 0.15, cr.rx);
      sh.addColorStop(0, "rgba(34,44,78,0.82)"); sh.addColorStop(0.7, "rgba(40,52,90,0.42)"); sh.addColorStop(1, "rgba(40,52,90,0)");
      ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cr.cx, cr.cy, cr.rx, cr.ry, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    const tpos = (tm: Terminal) => {
      const e = ease(ramp(t, tm.thr, tm.thr + 0.12));
      const sway = Math.sin(time * 0.6 + tm.ph) * (2.2 + (360 - tm.y) / 90);
      return { e, x: tm.x + sway, y: tm.y + Math.cos(time * 0.5 + tm.ph) * 1.3, sc: (tm.r / 64) * tm.sc0 * (0.42 + 0.58 * e) };
    };
    for (const tm of this.terminals) {
      const p = tpos(tm); if (p.e <= 0.02) continue;
      const fr = tm.r * p.sc * 1.78;
      ctx.save(); ctx.globalAlpha = Math.min(1, p.e) * 0.95;
      const fg = ctx.createRadialGradient(p.x - fr * 0.18, p.y - fr * 0.2, 0, p.x, p.y, fr);
      fg.addColorStop(0, "#6C89B4"); fg.addColorStop(0.5, "#52719E"); fg.addColorStop(0.85, "#3E5C86"); fg.addColorStop(1, "rgba(62,92,134,0)");
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    for (const tm of this.terminals) {
      const p = tpos(tm); if (p.e <= 0.001) continue;
      const tuft = this.tufts[tm.v];
      ctx.save(); ctx.globalAlpha = Math.min(1, p.e * 1.15);
      ctx.translate(p.x, p.y); ctx.scale(p.sc, p.sc);
      ctx.drawImage(tuft.canvas, -tuft.R, -tuft.R);
      ctx.restore();
      const bl = flIn * (1 - flOut);
      if (tm.blossom && bl > 0.01) {
        ctx.save();
        ctx.translate(p.x + Math.cos(tm.ph) * tm.r * 0.4, p.y - tm.r * 0.28 + Math.sin(tm.ph) * 6);
        this.drawFlower(ctx, 8 + (tm.ph % 1) * 4, 1, flOut * 0.6, bl * 0.95);
        ctx.restore();
      }
    }

    const hangA = ramp(t, 0.76, 0.8);
    const ax = this.ax, bob = Math.sin(time * 1.3) * 2.5;
    const ty = this.ay - 46 + bob;
    if (hangA > 0) {
      ctx.save(); ctx.globalAlpha = hangA;
      ctx.strokeStyle = "#6A6690"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax - 2, ty - 22 * hangA); ctx.quadraticCurveTo(ax + 3, ty - 10, ax, ty); ctx.stroke();
      ctx.strokeStyle = "rgba(235,240,248,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax - 3, ty - 20 * hangA); ctx.quadraticCurveTo(ax + 2, ty - 10, ax - 1, ty - 1); ctx.stroke();
      ctx.restore();
    }
    const bA = ramp(t, 0.78, 0.815) * (1 - ramp(t, 0.845, 0.875));
    if (bA > 0.01) { ctx.save(); ctx.translate(ax, ty + 9); this.drawBud(ctx, 9 + 5 * ramp(t, 0.78, 0.87), bA); ctx.restore(); }
    const fIn = ramp(t, 0.835, 0.885), fOut = ramp(t, 0.895, 0.935);
    if (fIn > 0.01 && fOut < 1) { ctx.save(); ctx.translate(ax, ty + 12); this.drawFlower(ctx, 24 * (0.55 + 0.45 * fIn), fIn, fOut, fIn * (1 - fOut)); ctx.restore(); }
    const fr = ramp(t, 0.9, 1);
    if (fr > 0) {
      const scale = 40 * (0.2 + 0.8 * ease(fr));
      const fy = ty + 10 + scale * 0.95;
      const glow = ramp(t, 0.93, 1);
      if (glow > 0) {
        const pulse = 1 + 0.07 * Math.sin(time * 2.2);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const wide = 135 * glow * pulse;
        let gl = ctx.createRadialGradient(ax, fy, 0, ax, fy, wide);
        gl.addColorStop(0, `rgba(205,228,248,${0.5 * glow})`); gl.addColorStop(0.45, `rgba(143,193,239,${0.26 * glow})`); gl.addColorStop(1, "rgba(143,193,239,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ax, fy, wide, 0, 6.2832); ctx.fill();
        const core = 44 * glow * pulse;
        gl = ctx.createRadialGradient(ax, fy, 0, ax, fy, core);
        gl.addColorStop(0, `rgba(238,247,255,${0.85 * glow})`); gl.addColorStop(1, "rgba(238,247,255,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ax, fy, core, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = Math.min(1, ramp(t, 0.9, 0.93));
      ctx.strokeStyle = "#6A6690"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax, ty + 2); ctx.quadraticCurveTo(ax + 3, ty + (fy - scale * 0.92 - ty) * 0.6, ax + 1, fy - scale * 0.92); ctx.stroke();
      ctx.translate(ax, fy); ctx.scale(scale, scale);
      this.drawApple(ctx, fr);
      ctx.restore();
      const sp = ramp(t, 0.95, 1);
      if (sp > 0) {
        const S = [[-74, -44, 9], [68, -22, 7], [-8, -96, 6], [44, 54, 6], [-92, 32, 5]];
        S.forEach((sPt, i) => { const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 2 + i * 1.7)); this.drawStar(ax + sPt[0], fy + sPt[1], sPt[2], sp * tw, "rgba(214,238,255,0.9)"); });
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (const mte of this.motes) {
          const mx = ax + Math.cos(time * mte.spd + mte.ph) * mte.rad;
          const my = fy + Math.sin(time * mte.spd * 0.8 + mte.ph) * mte.rad * 0.55;
          ctx.globalAlpha = sp * (0.25 + 0.5 * Math.abs(Math.sin(time * 1.4 + mte.ph)));
          ctx.fillStyle = "rgba(190,224,252,0.9)";
          ctx.beginPath(); ctx.arc(mx, my, mte.size, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /** Rendu STATIQUE à un niveau d'éveil (0→100). Une frame, aucun mouvement. */
  dessiner(eveil: number): void {
    if (!this.built || !this.ctx) return;
    this.draw(clamp(eveil, 0, 100) / 100, 0);
  }
}

export interface ProprietesArbreVivant {
  /** Niveau d'éveil 0→100 (du modèle). Le rendu le DESSINE, ne le calcule pas (AD-7). */
  eveil: number;
}

export default function ArbreVivant({ eveil }: ProprietesArbreVivant) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moteurRef = useRef<MoteurArbre | null>(null);

  // Construction une seule fois (squelette déterministe, seed fixe → arbre stable).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const moteur = new MoteurArbre(canvas);
    moteur.build();
    moteur.dessiner(eveil);
    moteurRef.current = moteur;
    return () => {
      moteurRef.current = null;
    };
    // Montage unique : la valeur d'éveil est répercutée par l'effet suivant ([eveil]).
  }, []);

  // Répercute les changements d'éveil (rare en 1.7 : la projection est un stub).
  useEffect(() => {
    moteurRef.current?.dessiner(eveil);
  }, [eveil]);

  return <canvas ref={canvasRef} aria-hidden />;
}
