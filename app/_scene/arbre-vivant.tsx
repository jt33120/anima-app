"use client";

import { useEffect, useMemo, useRef } from "react";

/*
 * L'arbre vivant — génératif, il se COMPLÈTE au fur et à mesure (scroll = progression).
 * Nu au début (tronc + racines), puis branches → feuilles → fruits → rayonnement.
 * MONOTONE : la croissance ne recule jamais (FR-029) — on remonte, l'arbre reste.
 * Face à nous, derrière l'eau. Habillé aux tokens Nuit galactique.
 */

// PRNG déterministe → arbre stable d'un rendu à l'autre
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Branche = { d: string; largeur: number; couleur: string; seuil: number };
type Feuille = { cx: number; cy: number; r: number; seuil: number };
type Fruit = { cx: number; cy: number; seuil: number };

function genererArbre() {
  const rnd = mulberry32(11);
  const branches: Branche[] = [];
  const feuilles: Feuille[] = [];
  const fruits: Fruit[] = [];
  const cx = 200;
  const base = 486;

  function pousse(
    x: number,
    y: number,
    angle: number,
    long: number,
    largeur: number,
    prof: number,
    seuil: number,
  ) {
    const x2 = x + Math.cos(angle) * long;
    const y2 = y + Math.sin(angle) * long;
    const mx = (x + x2) / 2 + Math.cos(angle + Math.PI / 2) * long * 0.14 * (rnd() - 0.5) * 2;
    const my = (y + y2) / 2 + Math.sin(angle + Math.PI / 2) * long * 0.14 * (rnd() - 0.5) * 2;
    branches.push({
      d: `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      largeur,
      couleur: prof === 0 ? "var(--arbre-tronc)" : "var(--arbre-branche)",
      seuil,
    });

    if (prof >= 4 || long < 16) {
      const nf = 7 + Math.floor(rnd() * 6);
      for (let i = 0; i < nf; i++) {
        feuilles.push({
          cx: x2 + (rnd() - 0.5) * 32,
          cy: y2 + (rnd() - 0.5) * 32,
          r: 3 + rnd() * 6, // touches de feuillage
          seuil: Math.min(0.97, seuil + 0.06 + rnd() * 0.14),
        });
      }
      if (rnd() < 0.28) fruits.push({ cx: x2, cy: y2, seuil: Math.min(0.98, seuil + 0.1) });
      return;
    }

    const n = prof === 0 ? 2 : rnd() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const spread = 0.55 + rnd() * 0.5;
      const na = angle - spread + (n > 1 ? (i / (n - 1)) * spread * 2 : spread) + (rnd() - 0.5) * 0.22;
      const nl = long * (0.68 + rnd() * 0.13);
      pousse(x2, y2, na, nl, Math.max(1.3, largeur * 0.66), prof + 1, seuil + 0.13 + rnd() * 0.05);
    }
  }

  pousse(cx, base, -Math.PI / 2, 96, 8.5, 0, 0);

  // racines — toujours présentes (seuil 0)
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.12 + i * Math.PI * 0.19;
    const rx = cx + Math.cos(a) * (26 + i * 9);
    branches.push({
      d: `M ${cx} ${base - 2} Q ${(cx + rx) / 2} ${base + 8} ${rx.toFixed(1)} ${(base + 16).toFixed(1)}`,
      largeur: 2.6,
      couleur: "var(--arbre-tronc)",
      seuil: 0,
    });
  }

  return { branches, feuilles, fruits };
}

const BANDE = 0.14; // douceur d'apparition autour du seuil
const lisse = (x: number) => Math.max(0, Math.min(1, x));

export default function ArbreVivant() {
  const arbre = useMemo(genererArbre, []);
  const groupeRef = useRef<SVGGElement>(null);
  const brRefs = useRef<SVGPathElement[]>([]);
  const fRefs = useRef<SVGCircleElement[]>([]);
  const fruitRefs = useRef<SVGGElement[]>([]);
  const gRef = useRef(0); // croissance monotone [0..1]

  useEffect(() => {
    // Hook de démo : ?epanoui=0.6 fige la croissance (pour capturer les étapes)
    const forced = parseFloat(
      new URLSearchParams(window.location.search).get("epanoui") ?? "",
    );
    const fige = !Number.isNaN(forced);
    if (fige) gRef.current = forced;

    let raf = 0;
    const boucle = () => {
      if (!fige) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const prog = max > 0 ? window.scrollY / max : 0;
        gRef.current = Math.max(gRef.current, prog); // MONOTONE
      }
      const g = gRef.current;

      for (let i = 0; i < arbre.branches.length; i++) {
        const el = brRefs.current[i];
        if (!el) continue;
        const local = lisse((g - arbre.branches[i].seuil) / BANDE);
        el.style.strokeDashoffset = String(1 - local);
        el.style.opacity = String(local);
      }
      for (let i = 0; i < arbre.feuilles.length; i++) {
        const el = fRefs.current[i];
        if (!el) continue;
        const local = lisse((g - arbre.feuilles[i].seuil) / BANDE);
        el.style.opacity = String(local * (0.78 + ((i % 5) / 5) * 0.22));
        el.style.transform = `scale(${0.4 + local * 0.6})`;
      }
      for (let i = 0; i < arbre.fruits.length; i++) {
        const el = fruitRefs.current[i];
        if (!el) continue;
        el.style.opacity = String(lisse((g - arbre.fruits[i].seuil) / BANDE));
      }
      // Rayonnement global : l'arbre luit de plus en plus en se complétant
      if (groupeRef.current) {
        const halo = 2 + g * g * 16;
        groupeRef.current.style.filter = `drop-shadow(0 0 ${halo}px rgba(143,193,239,${0.1 + g * 0.35}))`;
      }
      raf = requestAnimationFrame(boucle);
    };
    boucle();
    return () => cancelAnimationFrame(raf);
  }, [arbre]);

  return (
    <svg
      viewBox="0 0 400 520"
      width="100%"
      height="100%"
      role="img"
      aria-label="Ton arbre — il se complète à mesure que tu avances"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="flou-feuilles" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <g ref={groupeRef}>
        {arbre.branches.map((b, i) => (
          <path
            key={`b${i}`}
            ref={(el) => {
              if (el) brRefs.current[i] = el;
            }}
            d={b.d}
            fill="none"
            stroke={b.couleur}
            strokeWidth={b.largeur}
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              opacity: 0,
            }}
          />
        ))}
        <g filter="url(#flou-feuilles)">
        {arbre.feuilles.map((f, i) => (
          <circle
            key={`f${i}`}
            ref={(el) => {
              if (el) fRefs.current[i] = el;
            }}
            cx={f.cx}
            cy={f.cy}
            r={f.r}
            fill="var(--arbre-feuillage)"
            style={{ opacity: 0, transformOrigin: `${f.cx}px ${f.cy}px` }}
          />
        ))}
        </g>
        {arbre.fruits.map((f, i) => (
          <g
            key={`fr${i}`}
            ref={(el) => {
              if (el) fruitRefs.current[i] = el;
            }}
            style={{ opacity: 0 }}
          >
            <circle cx={f.cx} cy={f.cy} r={11} fill="var(--lueur)" opacity={0.25} />
            <circle cx={f.cx} cy={f.cy} r={4.5} fill="var(--accent)" />
          </g>
        ))}
      </g>
    </svg>
  );
}
