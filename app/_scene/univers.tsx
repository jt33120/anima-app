"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import ArbreVivant from "./arbre-vivant";

/*
 * Univers immersif d'Anam — moteur WebGL (spike vers AD-7, l'étoile du Nord 3D).
 * Profondeur réelle : le scroll fait avancer la caméra dans le champ d'étoiles/nébuleuses
 * → parallaxe (proche = vite, lointain = lent). Anam flotte à une profondeur ; on la
 * dépasse en plongeant. Étoiles/nébuleuses/lumière procédurales ; les vrais calques
 * peints (Gemini) viendront s'y composer. Neutralisé sous prefers-reduced-motion.
 */

// ── Texture procédurale : un disque doux (bokeh d'étoile) ──
function textureDisque(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(210,228,248,0.35)");
  g.addColorStop(1, "rgba(210,228,248,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Texture procédurale : une volute de nébuleuse (blob organique) ──
function textureNebuleuse(couleur: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 7; i++) {
    const cx = 128 + (Math.random() - 0.5) * 120;
    const cy = 128 + (Math.random() - 0.5) * 120;
    const r = 40 + Math.random() * 80;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, couleur.replace("ALPHA", "0.18"));
    g.addColorStop(1, couleur.replace("ALPHA", "0"));
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Texture radiale sombre : un voile derrière Anam pour qu'elle se détache ──
function textureVoileSombre(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(12,10,30,0.88)");
  g.addColorStop(0.6, "rgba(12,10,30,0.5)");
  g.addColorStop(1, "rgba(12,10,30,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export default function Univers() {
  const montRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mont = montRef.current;
    const overlay = overlayRef.current;
    if (!mont) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0c0a1e, 1);
    mont.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c0a1e, 0.0018);
    const camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    camera.position.set(0, 0, 60);

    // ── Champ d'étoiles (bokeh doux, en profondeur) ──
    const N = 3500;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const teintes = [
      new THREE.Color(0xeeecf7), // argent lunaire (majorité)
      new THREE.Color(0xeeecf7),
      new THREE.Color(0xcde4f8), // lueur nacrée
      new THREE.Color(0x8fc1ef), // lotus bleu
      new THREE.Color(0xd0a05c), // rare ambre lunaire
    ];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 900;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 2] = 60 - Math.random() * 1000;
      const t =
        teintes[Math.random() < 0.12 ? (Math.random() < 0.7 ? 2 : Math.random() < 0.85 ? 3 : 4) : 0];
      col[i * 3] = t.r;
      col[i * 3 + 1] = t.g;
      col[i * 3 + 2] = t.b;
    }
    const geoEtoiles = new THREE.BufferGeometry();
    geoEtoiles.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geoEtoiles.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const matEtoiles = new THREE.PointsMaterial({
      size: 2.6,
      map: textureDisque(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const etoiles = new THREE.Points(geoEtoiles, matEtoiles);
    scene.add(etoiles);

    // ── Nébuleuses (volutes douces, plusieurs profondeurs) ──
    const nebuleuses: THREE.Sprite[] = [];
    const specsNeb: [string, number][] = [
      ["rgba(90,70,150,ALPHA)", 520],
      ["rgba(60,50,120,ALPHA)", 620],
      ["rgba(40,80,140,ALPHA)", 460],
      ["rgba(120,90,170,ALPHA)", 400],
      ["rgba(50,60,130,ALPHA)", 700],
      ["rgba(80,110,160,ALPHA)", 360],
    ];
    specsNeb.forEach(([couleur, taille], i) => {
      const mat = new THREE.SpriteMaterial({
        map: textureNebuleuse(couleur),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.55,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(taille, taille, 1);
      s.position.set(
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 320,
        -80 - i * 130 - Math.random() * 80,
      );
      scene.add(s);
      nebuleuses.push(s);
    });

    // ── Lune (halo lunaire, très loin, en haut) ──
    const lune = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textureNebuleuse("rgba(205,228,248,ALPHA)"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 1,
      }),
    );
    lune.scale.set(340, 340, 1);
    lune.position.set(110, 150, -560);
    scene.add(lune);

    // ── Horizon d'eau lunaire — le SOL du lieu, ce sur quoi on se pose ──
    const eau = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textureNebuleuse("rgba(143,193,239,ALPHA)"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.5,
      }),
    );
    eau.scale.set(1000, 260, 1);
    eau.position.set(0, -150, -150);
    scene.add(eau);

    // ── Anam (calque détouré, flottant à une profondeur) ──
    let anam: THREE.Mesh | null = null;
    let vivant = true;
    new THREE.TextureLoader().load("/scene/univers/anam-seuil.png", (tex) => {
      if (!vivant) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      const h = 66;
      const w = h * (625 / 850);
      // voile sombre derrière elle → elle se détache du champ d'étoiles
      const voile = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textureVoileSombre(),
          transparent: true,
          depthWrite: false,
          opacity: 0.8,
        }),
      );
      voile.scale.set(w * 2.6, h * 1.5, 1);
      voile.position.set(26, -6, -74);
      scene.add(voile);
      anam = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      anam.position.set(26, -6, -72);
      anam.renderOrder = 5;
      scene.add(anam);
    });

    // ── Interaction ──
    let progCible = 0;
    let prog = 0;
    const majScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progCible = max > 0 ? window.scrollY / max : 0;
    };
    majScroll();
    window.addEventListener("scroll", majScroll, { passive: true });

    let sourisX = 0;
    let sourisY = 0;
    const onSouris = (e: MouseEvent) => {
      sourisX = e.clientX / window.innerWidth - 0.5;
      sourisY = e.clientY / window.innerHeight - 0.5;
    };
    if (!reduit) window.addEventListener("mousemove", onSouris);

    // Gyroscope (mobile) — l'inclinaison déplace le lieu, comme une fenêtre vers un espace réel.
    // iOS exige une permission déclenchée par un geste (premier toucher).
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      sourisX = Math.max(-0.5, Math.min(0.5, e.gamma / 40));
      sourisY = Math.max(-0.5, Math.min(0.5, (e.beta - 40) / 50));
    };
    const activerGyro = () => {
      const D = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (D && typeof D.requestPermission === "function") {
        D.requestPermission()
          .then((r) => {
            if (r === "granted") window.addEventListener("deviceorientation", onTilt);
          })
          .catch(() => {});
      } else {
        window.addEventListener("deviceorientation", onTilt);
      }
    };
    if (!reduit) window.addEventListener("touchend", activerGyro, { once: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // ── Boucle ──
    let raf = 0;
    let t = 0;
    const rendu = () => {
      prog += (progCible - prog) * 0.06;
      camera.position.z = 55 - prog * 90;

      if (!reduit) {
        t += 0.0015;
        etoiles.rotation.y = t * 0.35;
        etoiles.rotation.x = Math.sin(t * 0.5) * 0.03;
        nebuleuses.forEach((s, i) => {
          s.position.x += Math.sin(t * 0.6 + i) * 0.03;
          s.material.rotation = t * 0.05 * (i % 2 ? 1 : -1);
        });
        camera.position.x += (sourisX * 14 - camera.position.x) * 0.04;
        camera.position.y += (-sourisY * 10 - camera.position.y) * 0.04;
        if (anam) anam.position.y = -6 + Math.sin(t * 1.2) * 1.4;
      }

      if (anam) {
        const m = anam.material as THREE.MeshBasicMaterial;
        const cible = Math.min(1, Math.max(0, 1.1 - prog * 1.7));
        m.opacity += (cible - m.opacity) * 0.05;
      }
      if (overlay) overlay.style.opacity = String(Math.max(0, 1 - prog * 2.4));

      renderer.render(scene, camera);
      raf = requestAnimationFrame(rendu);
    };
    rendu();

    return () => {
      vivant = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", majScroll);
      window.removeEventListener("mousemove", onSouris);
      window.removeEventListener("touchend", activerGyro);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geoEtoiles.dispose();
      matEtoiles.dispose();
      if (mont.contains(renderer.domElement)) mont.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div
        ref={montRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "var(--fond)",
        }}
      />
      {/* L'arbre vivant — centre, derrière l'eau, il se complète au scroll */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: "16vh",
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "relative", width: "min(88vw, 30rem)", height: "66vh" }}>
          <ArbreVivant />
          {/* reflet dans l'eau — l'arbre inversé, estompé */}
          <div
            style={{
              position: "absolute",
              top: "92%",
              left: 0,
              width: "100%",
              height: "55%",
              transform: "scaleY(-1)",
              opacity: 0.22,
              filter: "blur(2px)",
              WebkitMaskImage: "linear-gradient(to bottom, #000, transparent 72%)",
              maskImage: "linear-gradient(to bottom, #000, transparent 72%)",
            }}
          >
            <ArbreVivant />
          </div>
        </div>
      </div>

      {/* Le sol — ton eau lunaire peinte */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: "20vh",
          zIndex: 2,
          backgroundImage: "url(/scene/univers/eau.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          pointerEvents: "none",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 40%)",
          maskImage: "linear-gradient(to bottom, transparent, #000 40%)",
        }}
      />

      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "var(--esp-4)",
          textAlign: "center",
          padding: "15vh 20px 0",
          pointerEvents: "none",
        }}
      >
        <p className="t-surtitre">une compagne d&apos;introspection</p>
        <h1 className="t-display">Anam</h1>
        <p className="t-anam" style={{ maxWidth: "min(32rem, 86vw)" }}>
          Bonsoir. Ce lieu ne te jugera pas — et ne te flattera pas non plus.
        </p>
        <p
          className="t-meta"
          style={{
            position: "absolute",
            bottom: "var(--esp-8)",
            left: 0,
            right: 0,
            opacity: 0.8,
          }}
        >
          avance — et regarde l&apos;arbre se compléter ↓
        </p>
      </div>
      {/* Pilote de scroll : donne de la hauteur pour plonger dans la profondeur */}
      <div aria-hidden="true" style={{ height: "360vh" }} />
    </>
  );
}
