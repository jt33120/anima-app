#!/usr/bin/env python3
"""
anima_video.py — Anima animée (image-to-video) via OpenRouter.

Pourquoi ce script existe : openrouter.ai est injoignable depuis Cowork (réseau
isolé), donc la génération tourne là où il y a du réseau — TA machine, TES crédits.
Une commande, et tu récupères le MP4. C'est aussi la brique vidéo du service phase 2.

──────────────────────────────────────────────────────────────────────────
PRÉREQUIS
    pip install requests
    export OPENROUTER_API_KEY="sk-or-v1-..."     # ta clé (PENSE À LA RÉGÉNÉRER,
                                                 #  elle a été collée en clair)
LANCER
    python anima_video.py
    python anima_video.py --model bytedance/seedance-1.0   # variante moins chère
    python anima_video.py --ref-url https://.../anima.png  # si data-URI refusé
──────────────────────────────────────────────────────────────────────────

Cohérence perso : on part TOUJOURS de la même référence (first_frame). Pour
verrouiller Anima entre plusieurs vidéos, garde la même image + le même prompt
de style + le même --seed. Attends-toi quand même à re-générer certaines prises.
"""
from __future__ import annotations
import argparse, base64, json, mimetypes, os, sys, time
from pathlib import Path
import urllib.request, urllib.error

BASE = "https://openrouter.ai/api/v1"

# ── Réglages par défaut (surchargables en CLI) ──────────────────────────
REF = "images/Gemini_Generated_Image_lifs80lifs80lifs.png"   # référence Anima (repo)
MODEL = "google/veo-3.1"        # top qualité + image-to-video. Seedance = moins cher.
ASPECT = "9:16"                 # réel vertical
RES = "1080p"
DURATION = 8
SEED = 70021                    # même seed = reproductible (n'assure pas la cohérence)
AUDIO = False                   # Veo ajoute un son ambiant si True
OUTDIR = "out/video"

PROMPT = (
    "Anima, une jeune femme vue de dos en longue robe blanche vaporeuse, marche "
    "lentement et sereinement dans une prairie aquarelle aux tons pastel (rose poudré, "
    "lavande, crème). Ses cheveux ondulés et le tissu de sa robe flottent doucement dans "
    "la brise. Lumière douce, halo lunaire en fond, pétales qui dérivent. Mouvement fluide "
    "et gracieux, ambiance onirique et paisible. Style illustration aquarelle, cohérent "
    "avec l'image de référence. Le visage reste hors champ, jamais montré."
)

def req(method, url, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/png"
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{b64}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default=REF)
    ap.add_argument("--ref-url", default=None, help="URL publique de la référence (si data-URI refusé)")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--prompt", default=PROMPT)
    ap.add_argument("--aspect", default=ASPECT)
    ap.add_argument("--res", default=RES)
    ap.add_argument("--duration", type=int, default=DURATION)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--audio", action="store_true", default=AUDIO)
    ap.add_argument("--outdir", default=OUTDIR)
    a = ap.parse_args()

    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("✗ export OPENROUTER_API_KEY=… d'abord (https://openrouter.ai/keys)")

    # référence : URL publique si fournie, sinon data-URI depuis le fichier local
    if a.ref_url:
        ref = a.ref_url
    else:
        p = Path(a.ref)
        if not p.exists():
            sys.exit(f"✗ référence introuvable : {p}  (lance le script depuis la racine du repo)")
        ref = data_uri(p)

    body = {
        "model": a.model,
        "prompt": a.prompt,
        "aspect_ratio": a.aspect,
        "resolution": a.res,
        "duration": a.duration,
        "seed": a.seed,
        "generate_audio": a.audio,
        "frame_images": [
            {"type": "image_url", "image_url": {"url": ref}, "frame_type": "first_frame"}
        ],
    }

    print(f"→ génération ({a.model}, {a.aspect}, {a.duration}s)…")
    st, j = req("POST", f"{BASE}/videos", key, body)
    if st not in (200, 201, 202):
        sys.exit(f"✗ POST {st} : {json.dumps(j, ensure_ascii=False)[:600]}")
    vid = j.get("id") or j.get("data", {}).get("id")
    poll = j.get("polling_url") or f"{BASE}/videos/{vid}"
    if not vid and not poll:
        sys.exit(f"✗ réponse inattendue : {json.dumps(j)[:600]}")
    print(f"  job {vid} — attente (la vidéo prend quelques minutes)…")

    # polling
    urls, t0 = None, time.time()
    while time.time() - t0 < 900:            # 15 min max
        time.sleep(10)
        st, j = req("GET", poll, key)
        status = (j.get("status") or j.get("data", {}).get("status") or "").lower()
        print(f"  … {status or st}", flush=True)
        if status in ("completed", "succeeded", "success", "done"):
            urls = j.get("unsigned_urls") or j.get("data", {}).get("unsigned_urls") \
                   or [o.get("url") for o in (j.get("output") or []) if isinstance(o, dict)]
            break
        if status in ("failed", "error", "canceled"):
            sys.exit(f"✗ génération échouée : {json.dumps(j, ensure_ascii=False)[:600]}")
    if not urls:
        sys.exit("✗ pas de vidéo (timeout ou format de réponse inattendu). Réponse :\n"
                 + json.dumps(j, ensure_ascii=False)[:800])

    out = Path(a.outdir); out.mkdir(parents=True, exist_ok=True)
    dest = out / "anima_marche.mp4"
    print(f"→ téléchargement → {dest}")
    urllib.request.urlretrieve(urls[0], dest)
    print(f"✓ terminé : {dest}  ({dest.stat().st_size//1024} Ko)")
    print("Vérifie : Anima reconnaissable, visage hors champ, palette pastel. Sinon relance (change le seed).")

if __name__ == "__main__":
    main()
