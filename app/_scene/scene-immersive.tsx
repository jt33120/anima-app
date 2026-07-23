"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import s from "./scene.module.css";

/* ────────────────────────────── Étoiles ──────────────────────────────
   Générées côté client après montage → aucun décalage d'hydratation.
   Elles paraissent en fondu (comme tout le reste). */
function Etoiles() {
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const etoiles = useMemo(() => {
    if (!monte) return [];
    return Array.from({ length: 80 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      taille: 1 + Math.random() * 2.2,
      retard: Math.random() * 4200,
      duree: 3200 + Math.random() * 3000,
    }));
  }, [monte]);

  if (!monte) return null;
  return (
    <div className={s.etoiles} aria-hidden>
      {etoiles.map((e, i) => (
        <span
          key={i}
          className={s.etoile}
          style={
            {
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: `${e.taille}px`,
              height: `${e.taille}px`,
              "--retard": `${e.retard}ms`,
              "--duree-etoile": `${e.duree}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ─────────────────────── L'arbre de nuit (SVG) ───────────────────────
   Écorce argentée, feuillage bleu-lune (feuilles individuelles, opacités
   variées), un seul fruit qui luit. Feuillage placé de façon déterministe
   autour des pointes de branches (pas de hasard → SSR sûr). */
function ArbreDeNuit() {
  const pointes = [
    { x: 200, y: 150 },
    { x: 130, y: 205 },
    { x: 270, y: 205 },
    { x: 100, y: 268 },
    { x: 302, y: 262 },
    { x: 172, y: 178 },
    { x: 232, y: 184 },
  ];
  const feuilles = pointes.flatMap((p, ci) =>
    Array.from({ length: 13 }, (_, i) => {
      const a = i * 2.399963 + ci; // angle d'or → dispersion organique
      const r = 5 + (i % 5) * 6.5;
      return {
        cx: p.x + Math.cos(a) * r,
        cy: p.y + Math.sin(a) * r * 0.92,
        rr: 2.3 + ((i + ci) % 3) * 1.1,
        op: 0.78 + (((i * 7 + ci * 5) % 23) / 100),
      };
    }),
  );

  return (
    <svg
      className={s.respire}
      viewBox="0 0 400 480"
      width="100%"
      role="img"
      aria-label="Un arbre de nuit"
    >
      {/* racines */}
      <g
        stroke="var(--arbre-tronc)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      >
        <path d="M200 442 C 176 452 150 452 118 461" />
        <path d="M200 442 C 224 452 250 452 286 461" />
        <path d="M200 444 C 195 456 189 462 174 470" />
        <path d="M200 444 C 205 456 213 462 230 470" />
      </g>

      {/* tronc */}
      <path
        d="M200 446 C 198 384 203 322 200 250"
        stroke="var(--arbre-tronc)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* branches */}
      <g
        stroke="var(--arbre-branche)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M200 250 C 200 220 200 190 200 154" />
        <path d="M200 262 C 176 244 150 232 132 208" />
        <path d="M200 258 C 224 242 250 230 268 208" />
        <path d="M200 300 C 168 292 128 288 102 270" />
        <path d="M200 296 C 232 288 272 284 300 264" />
        <path d="M200 214 C 188 200 180 190 174 180" />
        <path d="M200 210 C 212 198 222 190 230 186" />
      </g>
      {/* branche naissante — plus fine */}
      <path
        d="M132 208 C 122 200 114 197 106 192"
        stroke="var(--arbre-branche)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {/* feuillage */}
      <g>
        {feuilles.map((f, i) => (
          <circle
            key={i}
            cx={f.cx}
            cy={f.cy}
            r={f.rr}
            fill="var(--arbre-feuillage)"
            opacity={f.op}
          />
        ))}
      </g>

      {/* fruit — un seul, il luit (accent + halo lueur) */}
      <g className={s.fruit}>
        <circle cx="268" cy="208" r="13" fill="var(--lueur)" opacity="0.22" />
        <circle cx="268" cy="208" r="5.5" fill="var(--accent)" />
      </g>
    </svg>
  );
}

/* Le signe d'Anam — un lotus, respirant. Suffit entre ses apparitions. */
function SigneLotus() {
  return (
    <svg className={s.signe} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M20 31 C 12 27 8 18 20 8 C 32 18 28 27 20 31 Z"
        stroke="var(--texte)"
        strokeWidth="1.4"
        opacity="0.92"
      />
      <path
        d="M20 31 C 14 29 6 24 5 16 C 15 18 18 25 20 31 Z"
        stroke="var(--texte)"
        strokeWidth="1.1"
        opacity="0.6"
      />
      <path
        d="M20 31 C 26 29 34 24 35 16 C 25 18 22 25 20 31 Z"
        stroke="var(--texte)"
        strokeWidth="1.1"
        opacity="0.6"
      />
      <circle cx="20" cy="14" r="1.6" fill="var(--lueur)" />
    </svg>
  );
}

const LIGNES_ANAM = [
  "Te voilà. Prends le temps d’arriver.",
  "Cet arbre, c’est toi. Il ne note rien — il retient ce qui compte.",
  "Chaque branche est une chose que tu as fini par voir. Le fruit, un pas que tu as osé.",
];

/* ────────────────────────── La scène ────────────────────────── */
export default function SceneImmersive() {
  const [region, setRegion] = useState<"seuil" | "arbre">("seuil");
  const [entrees, setEntrees] = useState(0);
  const cielRef = useRef<HTMLDivElement>(null);
  const avantRef = useRef<HTMLDivElement>(null);

  // Parallaxe douce au pointeur (désactivée sous prefers-reduced-motion)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        if (cielRef.current)
          cielRef.current.style.transform = `translate(${dx * -14}px, ${dy * -10}px)`;
        if (avantRef.current)
          avantRef.current.style.transform = `translate(${dx * 16}px, ${dy * 11}px)`;
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const entrer = () => {
    setRegion("arbre");
    setEntrees((n) => n + 1);
  };

  return (
    <main className={s.monde}>
      {/* Ciel persistant — la scène est une, seul le premier plan change */}
      <div className={s.ciel} ref={cielRef} aria-hidden>
        <div className={s.lune} />
      </div>
      <Etoiles />
      <div className={s.grain} aria-hidden />

      <div className={s.parallaxe} ref={avantRef}>
        {/* ─────────── Région : le seuil ─────────── */}
        <section
          className={`${s.region} ${s.seuil} ${region === "seuil" ? s.regionActive : ""}`}
          aria-hidden={region !== "seuil"}
        >
          <div className={s.anamSeuil}>
            <Image
              src="/scene/anam-seuil.png"
              alt="Illustration nocturne"
              width={434}
              height={566}
              priority
            />
          </div>
          <div className={s.seuilTexte}>
            <h1 className="t-display">Anam</h1>
            <p className="t-anam">
              Bonsoir. Ce lieu ne te jugera pas — et ne te flattera pas non plus.
            </p>
            <button className={s.affordance} onClick={entrer} type="button">
              <span className="t-bouton">entrer dans le monde</span>
            </button>
          </div>
        </section>

        {/* ─────────── Région : l'arbre ─────────── */}
        <section
          className={`${s.region} ${s.arbre} ${region === "arbre" ? s.regionActive : ""}`}
          aria-hidden={region !== "arbre"}
        >
          {region === "arbre" && (
            <button
              className={s.retour}
              onClick={() => setRegion("seuil")}
              type="button"
            >
              <span className="t-meta">revenir au seuil</span>
            </button>
          )}

          <div className={s.arbreWrap} key={`arbre-${entrees}`}>
            <div className={s.arbreSol} />
            <ArbreDeNuit />
          </div>

          <div className={s.voix} key={`voix-${entrees}`}>
            <SigneLotus />
            {LIGNES_ANAM.map((ligne, i) => (
              <p
                key={i}
                className={`t-anam ${s.voixLigne}`}
                style={{ animationDelay: `${450 + i * 1500}ms` }}
              >
                {ligne}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
