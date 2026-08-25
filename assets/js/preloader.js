const WeboostPreloader = (() => {
'use strict';

/* ───────────────────────── 1. CONFIG ───────────────────────── */
const CONFIG = {
  bg:            '#050505',
  logoMain:      'WEBOOST',
  logoSub:       'STUDIO',

  // Densité : adaptée automatiquement au device (voir tier())
  particles:     { high: 3400, mid: 2400, low: 1500 },
  sampleStep:    { high: 4,    mid: 5,    low: 7    },

  dprMax:        1,      // plafonne le rendu rétina (gros gain FPS)
  soundEnabled:  false,    // passe à true pour activer l'ambiance sonore
  oncePerSession:true,     // l'intro ne joue qu'une fois par visite
  minFrameMs:    1000/30   // clamp du delta (onglet en arrière-plan)
};

/* ───────────────────────── 2. UTILS ───────────────────────── */
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const rand  = (a,b) => a + Math.random() * (b - a);
const TAU   = Math.PI * 2;

/* Easings custom passés directement à GSAP (fonctions p → 0..1).
   Aucun plugin requis, aucune courbe "robotique". */
const EASE = {
  // Décélération très longue : le mouvement "se pose" au lieu de s'arrêter
  cine:    p => 1 - Math.pow(1 - p, 5.2),
  // Accélération sourde puis fuite : parfait pour l'aspiration du vortex
  suck:    p => p * p * p * (1 + 0.35 * p),
  // Impact : monte instantanément, retombe en douceur
  impact:  p => 1 - Math.pow(1 - p, 8)
};

/* Bruit organique bon marché (somme de sinus déphasés).
   Suffisant visuellement, ~40× moins cher qu'un simplex noise. */
const noise = (x, y) =>
  Math.sin(x * 1.73 + Math.cos(y * 1.31)) * 0.5 +
  Math.sin(y * 2.11 + Math.cos(x * 0.79)) * 0.5;

/* Détection du niveau de performance du device */
function tier(){
  const mem   = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(innerWidth, innerHeight) < 700;
  if (small || mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4)          return 'mid';
  return 'high';
}

/* ─────────────────── 3. SPRITES (bloom pré-calculé) ─────────────────── */
/* On dessine chaque particule via drawImage d'un dégradé radial mis en
   cache. Combiné à globalCompositeOperation='lighter', ça donne un vrai
   bloom additif à coût quasi nul (vs shadowBlur qui tue le framerate). */
function makeSprite(stops, size = 64){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

const SPRITES = {
  // Sprites "brume" : halo large, bokeh, profondeur
  white: makeSprite([
    [0,   'rgba(255,255,255,1)'],
    [0.18,'rgba(255,255,255,.65)'],
    [0.45,'rgba(190,225,255,.16)'],
    [1,   'rgba(255,255,255,0)']
  ]),
  cyan: makeSprite([
    [0,   'rgba(255,244,228,1)'],
    [0.16,'rgba(201,168,124,.72)'],
    [0.44,'rgba(160,120,70,.16)'],
    [1,   'rgba(120,90,50,0)']
  ]),
  /* Sprites "core" : dégradé très serré, presque un disque.
     Indispensables pour le logo — un halo large remplit les contreformes
     des lettres et rend le mot illisible. */
  coreWhite: makeSprite([
    [0,   'rgba(255,255,255,1)'],
    [0.42,'rgba(255,255,255,.94)'],
    [0.62,'rgba(210,240,255,.30)'],
    [1,   'rgba(255,255,255,0)']
  ]),
  coreCyan: makeSprite([
    [0,   'rgba(235,254,255,1)'],
    [0.42,'rgba(120,240,255,.92)'],
    [0.62,'rgba(0,200,255,.28)'],
    [1,   'rgba(0,180,255,0)']
  ])
};

/* Tuile de grain animé — une seule génération, décalée chaque frame */
function makeGrain(size = 128){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g   = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4){
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 16;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const GRAIN = makeGrain();

/* ─────────────────── 4. LOGO ─────────────────── */
/* Rend le logo dans un canvas offscreen et renvoie :
     · points → cibles pour les particules
     · sharp  → le logo NET, superposé pendant la pose (garantit la lecture)
     · glow   → une copie floutée cyan, pour le halo sous le texte
   Les particules seules ne peuvent pas rester lisibles à cette taille :
   elles apportent la matière et le scintillement, le calque net apporte
   la typographie. */
function buildLogo(w, h, step){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently:true });

  // — Ligne principale : "WEBOOST", tracking manuel pour un contrôle exact
  const targetW = Math.min(w * 0.74, 940);
  let size = Math.min(w * 0.155, 190);
  const track = () => size * 0.055;

  const measure = (txt, s, t) => {
    g.font = `700 ${s}px "Space Grotesk", system-ui, sans-serif`;
    let tot = 0;
    for (const ch of txt) tot += g.measureText(ch).width + t;
    return tot - t;
  };

  // Ajuste la taille pour tenir pile dans targetW
  size *= targetW / measure(CONFIG.logoMain, size, track());
  size  = Math.min(size, h * 0.30);

  const drawTracked = (txt, s, t, cy) => {
    g.font = `700 ${s}px "Space Grotesk", system-ui, sans-serif`;
    g.textBaseline = 'middle';
    const total = measure(txt, s, t);
    let x = (w - total) / 2;
    for (const ch of txt){
      g.fillText(ch, x, cy);
      x += g.measureText(ch).width + t;
    }
  };

  g.fillStyle = '#fff';
  const baseY = h / 2 - size * 0.14;
  drawTracked(CONFIG.logoMain, size, track(), baseY);

  // — Sous-ligne : "STUDIO", plus grand qu'un simple sous-titre pour rester
  //   lisible en particules, tracking large (contraste typographique)
  const subSize = size * 0.225;
  drawTracked(CONFIG.logoSub, subSize, subSize * 0.60, baseY + size * 0.76);

  // — Extraction des pixels opaques
  const data = g.getImageData(0, 0, w, h).data;
  const pts  = [];
  for (let y = 0; y < h; y += step){
    for (let x = 0; x < w; x += step){
      if (data[(y * w + x) * 4 + 3] > 130){
        pts.push({ x: x + rand(-0.6, 0.6), y: y + rand(-0.6, 0.6) });
      }
    }
  }

  // — Halo cyan : copie floutée puis teintée. Calculée une seule fois,
  //   donc aucun filtre coûteux à l'exécution.
  const glow = document.createElement('canvas');
  glow.width = w; glow.height = h;
  const gg = glow.getContext('2d');
  gg.filter = `blur(${Math.max(9, size * 0.15)}px)`;
  gg.drawImage(c, 0, 0);
  gg.filter = 'none';
  gg.globalCompositeOperation = 'source-in';
  gg.fillStyle = 'rgba(201,168,124,1)';
  gg.fillRect(0, 0, w, h);

  return { points: pts, sharp: c, glow };
}

/* ─────────────────── 5. CHAMP DE PARTICULES ─────────────────── */
class ParticleField {
  constructor(count, w, h){
    this.w = w; this.h = h;
    this.list = new Array(count);
    for (let i = 0; i < count; i++){
      const z = Math.random();                    // profondeur → DOF + parallaxe
      this.list[i] = {
        x: rand(0, w), y: rand(0, h),
        vx: 0, vy: 0,
        tx: w / 2, ty: h / 2,                     // cible logo
        z,
        size:  rand(1.1, 2.6) + z * 2.4,          // rayon en mode brume (bokeh)
        zs:    rand(0, 0.7),                      // variation de rayon en mode logo
        alpha: 0.16 + (1 - z) * 0.62,             // les lointaines s'effacent
        k:     0.012 + Math.random() * 0.030,     // raideur du ressort (inertie)
        drag:  0.90  + Math.random() * 0.055,
        cyan:  Math.random() < 0.22,              // 22 % d'accent : le blanc porte la lecture
        nx: rand(0, 100), ny: rand(0, 100),       // graine de bruit
        tw: 0.5 + Math.random(),                  // sensibilité à la turbulence
        energy: 0,                                // brillance temporaire
        release: Math.random()                    // seuil de désintégration
      };
    }
  }

  /* Assignation des cibles par tri angulaire : les particules rejoignent
     le point le plus "naturel" pour elles → aucune trajectoire croisée,
     la formation du logo se fait comme une nuée qui se pose. */
  assign(points){
    if (!points.length) return;
    const cx = this.w / 2, cy = this.h / 2;
    const n  = this.list.length;

    /* ⚠️ Si le logo produit plus de points que de particules, il faut
       sous-échantillonner RÉGULIÈREMENT. Une simple troncature laisserait
       des lettres entières vides (les points sont triés par angle). */
    let src = points;
    if (points.length > n){
      const stride = points.length / n;
      src = new Array(n);
      for (let i = 0; i < n; i++) src[i] = points[(i * stride) | 0];
    }

    const ang = o => Math.atan2(o.y - cy, o.x - cx);
    const P = src.slice().sort((a, b) => ang(a) - ang(b));
    const L = this.list.slice().sort((a, b) => ang(a) - ang(b));
    for (let i = 0; i < L.length; i++){
      const t = P[i % P.length];
      L[i].tx = t.x + rand(-0.7, 0.7);
      L[i].ty = t.y + rand(-0.7, 0.7);
      L[i].wx = (t.x / this.w);   // position normalisée → stagger de l'onde
    }
  }

  update(S, scan, k, time){
    const cx = this.w / 2, cy = this.h / 2;
    const list = this.list;

    for (let i = 0; i < list.length; i++){
      const p = list[i];

      /* — Turbulence organique : la brume ne "flotte" jamais en boucle */
      if (S.turb > 0.001){
        const n = noise(p.nx + time * 0.28, p.ny + time * 0.19) * Math.PI;
        p.vx += Math.cos(n) * S.turb * p.tw;
        p.vy += Math.sin(n) * S.turb * p.tw * 0.75;
      }

      /* — Onde de choc de la ligne cyan : les particules sont physiquement
           poussées, avec un pic d'énergie qui les fait briller */
      if (scan.live){
        const d  = p.x - scan.x;
        const ad = Math.abs(d);
        if (ad < scan.reach){
          const f = 1 - ad / scan.reach;
          const push = f * f * scan.force;
          p.vx += (d >= 0 ? 1 : -1) * push;
          p.vy += ((p.y - cy) / this.h) * push * 1.6;
          if (f > p.energy) p.energy = f;
        }
      }

      /* — Convergence vers le logo (ressort + inertie individuelle) */
      if (S.converge > 0.001){
        p.vx += (p.tx - p.x) * p.k * S.converge;
        p.vy += (p.ty - p.y) * p.k * S.converge;
      }

      /* — Respiration du logo : dilatation/contraction très lente autour
           du centre. Le logo est vivant, jamais figé. */
      if (S.breathe > 0.001){
        const br = Math.sin(time * 1.5) * 0.0009 * S.breathe;
        p.x += (p.x - cx) * br;
        p.y += (p.y - cy) * br;
      }

      /* — Onde d'énergie qui parcourt le logo (gauche → droite) */
      if (S.waveOn && p.wx !== undefined){
        const d = Math.abs(p.wx - S.waveX);
        if (d < 0.10){
          const f = 1 - d / 0.10;
          if (f > p.energy) p.energy = f;
          p.vy -= f * f * 0.55;               // léger soulèvement
          p.vx += f * f * 0.30;
        }
      }

      /* — Désintégration : libération séquencée dans le sillage de l'onde */
      if (S.disint > 0 && !p.freed && S.disint > p.release * 0.85){
        p.freed = true;
        const a = Math.atan2(p.y - cy, p.x - cx) + rand(-0.6, 0.6);
        const s = rand(1.2, 6.5);
        p.vx += Math.cos(a) * s;
        p.vy += Math.sin(a) * s - rand(0, 1.4);
        p.energy = Math.max(p.energy, rand(0.4, 1));
      }

      /* — Vortex : force tangentielle + aspiration radiale.
           Les particules proches tournent plus vite (rotation différentielle
           comme une galaxie) → spirale, pas un cercle plat. */
      if (S.vortex > 0.001){
        const dx = p.x - cx, dy = p.y - cy;
        const r  = Math.hypot(dx, dy) || 1;
        const ux = dx / r, uy = dy / r;
        const spin = S.vortex * (1.9 + 260 / (r + 90));
        p.vx += -uy * spin - ux * S.vortex * (2.4 + r * 0.010);
        p.vy +=  ux * spin - uy * S.vortex * (2.4 + r * 0.010);
        p.energy = Math.min(1, p.energy + S.vortex * 0.028);
      }

      /* — Intégration + amortissement (plus serré quand le logo est posé) */
      const drag = p.drag - S.grip * 0.06;
      p.vx *= drag; p.vy *= drag;
      p.x  += p.vx * k;
      p.y  += p.vy * k;

      p.energy *= 0.935;                       // décroissance de la brillance
    }
  }
}

/* ─────────────────── 6. RENDERER ─────────────────── */
class Renderer {
  constructor(canvas){
    this.cv  = canvas;
    this.ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
    this.grainT = 0;
  }

  resize(w, h){
    this.w = w; this.h = h;
    this.dpr = Math.min(devicePixelRatio || 1, CONFIG.dprMax);
    this.cv.width  = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = CONFIG.bg;
    this.ctx.fillRect(0, 0, w, h);
  }

  draw(field, S, scan, time, logo){
    const ctx = this.ctx, w = this.w, h = this.h;
    const cx = w / 2, cy = h / 2;

    /* — Motion blur : au lieu d'effacer, on peint un voile noir.
         Plus il est transparent, plus les traînées sont longues. */
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(5,5,5,${S.trail})`;
    ctx.fillRect(0, 0, w, h);

    /* — Caméra virtuelle : dérive lente + poussée dans le vortex */
    const camX = Math.sin(time * 0.34) * 9 * S.camDrift;
    const camY = Math.cos(time * 0.27) * 6 * S.camDrift;
    ctx.save();
    ctx.translate(cx + camX, cy + camY);
    ctx.scale(S.camZ, S.camZ);
    ctx.translate(-cx, -cy);

    /* — Particules, en additif (bloom) */
    ctx.globalCompositeOperation = 'lighter';
    const list = field.list;
    for (let i = 0; i < list.length; i++){
      const p = list[i];
      if (p.x < -120 || p.x > w + 120 || p.y < -120 || p.y > h + 120) continue;

      const e = p.energy;
      const c = S.crisp;                          // 0 = brume · 1 = logo net

      // Depth of field : hors focus = grand et doux (uniquement en brume)
      const dof  = 1 + p.z * 1.5 * S.dof;
      const soft = p.size * dof;                  // rayon bokeh
      const tight = 1.0 + p.zs * 0.8;             // rayon ≈ 1 à 1.6 px

      /* ⚠️ CLÉ DE LA LISIBILITÉ : on interpole vers un point quasi ponctuel.
         Des particules de 10 px remplissent les contreformes des lettres
         (l'intérieur du O, du B, du E) et le mot devient une tache. */
      const s = (soft * (1 - c) + tight * c) * (1 + e * 2.1);
      if (s < 0.06) continue;

      // Le DOF ne doit plus assombrir une fois la mise au point faite
      const a = clamp(
        p.alpha * S.alpha * S.glow * (0.55 + e * 1.5) / (1 + (dof - 1) * (1 - c)),
        0, 1
      );
      if (a < 0.004) continue;

      const isCyan = p.cyan || e > 0.45;

      // Crossfade halo → core : bref (~0.6 s), donc coût négligeable
      if (c < 0.88){
        ctx.globalAlpha = a * (1 - c);
        ctx.drawImage(isCyan ? SPRITES.cyan : SPRITES.white,
                      p.x - s, p.y - s, s * 2, s * 2);
      }
      if (c > 0.12){
        ctx.globalAlpha = a * c;
        ctx.drawImage(isCyan ? SPRITES.coreCyan : SPRITES.coreWhite,
                      p.x - s, p.y - s, s * 2, s * 2);
      }
    }

    /* — Le logo NET, allumé par les particules qui se sont posées dessus.
         Halo cyan d'abord (profondeur), puis le blanc pur (lisibilité). */
    if (logo && S.logoText > 0.004){
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(S.logoText * 0.55, 0, 1);
      ctx.drawImage(logo.glow, 0, 0, w, h);
      ctx.globalAlpha = clamp(S.logoText, 0, 1);
      ctx.drawImage(logo.sharp, 0, 0, w, h);
    }

    /* — Ligne de scan : cœur blanc + halo cyan, dessinée en additif */
    if (scan.live && S.alpha > 0){
      const g = ctx.createLinearGradient(scan.x - 90, 0, scan.x + 90, 0);
      g.addColorStop(0,   'rgba(201,168,124,0)');
      g.addColorStop(0.42,'rgba(201,168,124,.20)');
      g.addColorStop(0.5, 'rgba(252,244,232,.58)');
      g.addColorStop(0.58,'rgba(201,168,124,.20)');
      g.addColorStop(1,   'rgba(201,168,124,0)');
      ctx.globalAlpha = scan.alpha;
      ctx.fillStyle = g;
      ctx.fillRect(scan.x - 90, 0, 180, h);
    }
    ctx.restore();

    /* — Aberration chromatique : copie décalée de la scène, uniquement
         pendant les pics d'énergie (coût = 1 blit, invisible en FPS). */
    if (S.aberr > 0.004){
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = S.aberr * 0.5;
      ctx.drawImage(this.cv, -S.aberr * 14, 0, w, h);
      ctx.drawImage(this.cv,  S.aberr * 14, 0, w, h);
    }

    /* — Grain animé : casse le banding des dégradés, texture "pellicule" */
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5 * (1 - S.crisp * 0.7);   // le grain mange la netteté du logo
    this.grainT = (this.grainT + 1) % 4;
    const ox = -(Math.random() * 128) | 0, oy = -(Math.random() * 128) | 0;
    const pat = ctx.createPattern(GRAIN, 'repeat');
    ctx.save(); ctx.translate(ox, oy);
    ctx.fillStyle = pat; ctx.fillRect(0, 0, w + 128, h + 128);
    ctx.restore();

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

/* ─────────────────── 7. SÉQUENCE ─────────────────── */
class Sequence {
  constructor(){
    this.pre   = document.getElementById('preloader');
    this.cv    = document.getElementById('scene');
    this.flare = document.getElementById('flare');
    this.flash = document.getElementById('flash');
    this.white = document.getElementById('white');
    this.skip  = document.getElementById('skip');

    /* État global animé par GSAP — un seul objet, une seule source de vérité */
    this.S = {
      alpha:0, turb:0, converge:0, breathe:0, grip:0,
      waveOn:false, waveX:-0.2, disint:0, vortex:0,
      trail:0.30, camZ:1, camDrift:0, dof:1, aberr:0, glow:1, crisp:0, logoText:0
    };
    this.scan = { x:-300, live:false, alpha:0, reach:170, force:0, };

    this.time = 0; this.last = 0; this.raf = 0; this.done = false;
  }

  build(){
    const t   = tier();
    const w   = innerWidth, h = innerHeight;
    this.renderer = new Renderer(this.cv);
    this.renderer.resize(w, h);
    this.field = new ParticleField(CONFIG.particles[t], w, h);
    this.logo  = buildLogo(w, h, CONFIG.sampleStep[t]);
    this.field.assign(this.logo.points);
    this.scan.reach = t === 'low' ? 130 : 170;

    addEventListener('resize', () => this.onResize(), { passive:true });
  }

  onResize(){
    if (this.done) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.resize(w, h);
    this.field.w = w; this.field.h = h;
    this.logo = buildLogo(w, h, CONFIG.sampleStep[tier()]);
    this.field.assign(this.logo.points);
  }

  loop = (now) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, CONFIG.minFrameMs / 1000 * 2);
    this.last = now;
    this.time += dt;
    const k = clamp(dt * 60, 0.2, 2);          // step normalisé 60fps
    this.field.update(this.S, this.scan, k, this.time);
    this.renderer.draw(this.field, this.S, this.scan, this.time, this.logo);
  };

  /* ── Timeline maître ─────────────────────────────────────────
     Durée totale ≈ 5,4 s. Toutes les phases se chevauchent :
     aucune ne "attend" la précédente.                          */
  play(readyPromise){
    const S = this.S, scan = this.scan;
    const W = () => innerWidth;

    this.last = performance.now();
    this.raf  = requestAnimationFrame(this.loop);
    gsap.delayedCall(1.2, () => gsap.to(this.skip, { opacity:.45, duration:.5 }));

    /* L'intro est jouée en accéléré : au-delà de deux secondes et demie, le
   voile opaque pénalise lourdement la mesure de complétude visuelle. */
  const tl = gsap.timeline({ onComplete: () => this.finish() });
    /* L'intro garde son tempo d'origine. Sa durée ne pèse que sur la mesure
       de complétude visuelle — un dixième de la note — parce que le hero est
       peint sous le voile dès le premier rendu : les indicateurs principaux
       sont relevés bien avant que le rideau ne se lève. */
    tl.timeScale(1);
    this.tl = tl;

    /* ▸ 0.0–1.0 · LA BRUME
       La scène s'éveille. Rien ne bouge vite. On installe la profondeur. */
    tl.to(S, { alpha:1,      duration:1.1, ease:'power2.out' }, 0)
      .to(S, { turb:0.085,   duration:1.3, ease:'sine.out'   }, 0)
      .to(S, { camDrift:1,   duration:1.5, ease:'sine.out'   }, 0)
      .to(S, { trail:0.20,   duration:1.0                    }, 0);

    /* ▸ Gate de chargement INVISIBLE.
       Si les assets ne sont pas prêts, la timeline attend ici — dans la
       brume, donc le visiteur ne voit aucune pause. Aucun %, aucun texte. */
    tl.call(() => {
      if (!this.ready){
        tl.pause();
        readyPromise.then(() => { this.ready = true; tl.play(); });
      }
    }, null, 0.95);

    /* ▸ 1.0–1.55 · LA LIGNE
       Traversée quasi instantanée. power4.inOut : elle jaillit et se pose. */
    tl.call(() => { scan.live = true; scan.force = 7.5; }, null, 1.02)
      .fromTo(scan, { x:-260 }, { x:() => W()+260, duration:0.52, ease:'power4.inOut' }, 1.02)
      .fromTo(scan, { alpha:0 }, { alpha:1, duration:0.12, ease:'power2.out' }, 1.02)
      .to(scan,  { alpha:0, duration:0.30, ease:'power2.in' }, 1.30)
      .to(S,     { aberr:0.30, duration:0.24, ease:EASE.impact }, 1.05)
      .to(S,     { aberr:0,    duration:0.55, ease:'power2.out' }, 1.25)
      .to(S,     { trail:0.13, duration:0.20 }, 1.02)
      .call(() => { scan.live = false; }, null, 1.62);

    // Lens flare synchronisé sur le passage de la ligne
    tl.fromTo(this.flare,
        { scaleX:0, opacity:0 },
        { scaleX:1, opacity:.42, duration:0.42, ease:'power2.out' }, 1.06)
      .to(this.flare, { opacity:0, duration:0.5, ease:'power2.out' }, 1.32);

    /* ▸ 1.35–3.0 · LA CONVERGENCE
       expo.out : départ violent, arrivée qui glisse. Les particules se
       posent sur le logo avec leur inertie propre → aucun snap. */
    tl.to(S, { converge:1, duration:1.7, ease:'expo.out' }, 1.32)
      .to(S, { turb:0.012, duration:1.5, ease:'power2.out' }, 1.32)
      .to(S, { grip:1,     duration:1.2, ease:'power2.out' }, 1.75)
      .to(S, { dof:0.18,   duration:1.4, ease:'power3.out' }, 1.5)   // mise au point
      .to(S, { crisp:1,    duration:1.35, ease:'power2.out' }, 1.55) // brume → points nets
      .to(S, { trail:0.25, duration:0.9, ease:'power2.out' }, 1.7)
      .to(S, { glow:2.0,   duration:1.7, ease:'power2.out' }, 1.45)  // le logo s'allume
      .to(S, { logoText:1, duration:1.15, ease:'power2.inOut' }, 1.95) // le mot se révèle
      .to(S, { camZ:1.05,  duration:2.4, ease:'power2.out' }, 1.4);

    /* ▸ 2.95–3.8 · LE LOGO RESPIRE, PUIS L'ONDE LE TRAVERSE */
    tl.to(S, { breathe:1, duration:0.7, ease:'sine.inOut' }, 2.85)
      .call(() => { S.waveOn = true; }, null, 3.10)
      .fromTo(S, { waveX:-0.15 }, { waveX:1.15, duration:0.72, ease:'power2.inOut' }, 3.10)
      .to(S, { aberr:0.20, duration:0.5, ease:'sine.inOut', yoyo:true, repeat:1 }, 3.15)
      .call(() => { S.waveOn = false; }, null, 3.85);

    /* ▸ 3.5–4.6 · LA DISSOLUTION
       Le logo n'explose pas : il relâche sa prise. Les particules dérivent
       vers l'extérieur à basse vitesse en perdant leur éclat, et la caméra
       avance doucement à travers elles. Aucune accélération, aucun pic. */
    tl.to(S, { disint:0.55, duration:1.15, ease:'sine.inOut' }, 3.50)
      .to(S, { logoText:0,  duration:0.85, ease:'power1.inOut' }, 3.52)
      .to(S, { converge:0,  duration:0.95, ease:'sine.inOut' }, 3.55)
      .to(S, { grip:0,      duration:0.8 }, 3.55)
      .to(S, { crisp:0,     duration:0.9,  ease:'sine.inOut' }, 3.58)
      .to(S, { glow:0.85,   duration:1.2,  ease:'sine.inOut' }, 3.58)
      .to(S, { turb:0.10,   duration:1.0 }, 3.58)
      .to(S, { trail:0.30,  duration:0.9,  ease:'sine.out' }, 3.60)
      .to(S, { dof:1.1,     duration:1.3,  ease:'sine.inOut' }, 3.60);

    /* ▸ 4.1–5.2 · LA SORTIE PAR LE NOIR
       Le poussée de caméra est lente et courte, l'éclat s'éteint au lieu
       de saturer. Pas de vortex, pas de voile blanc : le regard n'a rien
       à encaisser. */
    tl.to(S, { camZ:1.12, duration:1.5, ease:'sine.inOut' }, 4.10)
      .to(S, { alpha:0,   duration:0.70, ease:'sine.inOut' }, 3.92)
      /* Une lueur laiton très basse, qui respire une fois et se retire */
      .to(this.flash, { opacity:.20, scale:.95, duration:0.9, ease:'sine.out' }, 4.20)
      .to(this.flash, { opacity:0,   duration:1.0, ease:'sine.inOut' }, 4.95)
      /* Le feu vert au hero : il démarre pendant que le rideau s'efface,
         jamais après. Sans cet appel, l'index attend la fin du timeline. */
      .call(() => this.release(), null, 4.66)
      .to(this.pre,   { opacity:0,   duration:0.80, ease:'power2.out' }, 4.70)
      .to(this.skip,  { opacity:0,   duration:0.3 }, 4.60);

    if (CONFIG.soundEnabled) Audio.attach(tl);
  }

  /* Émis une seule fois, quel que soit le chemin (fin, Échap, bouton) */
  release(){
    if (this.released) return;
    this.released = true;
    /* On coupe la simulation AVANT de rendre la main : sinon les 5 200
       particules du preloader tournent en même temps que le champ du hero,
       et la première seconde saccade. Le canevas garde sa dernière image
       pendant que le rideau s'efface — invisible à cette opacité. */
    cancelAnimationFrame(this.raf);
    document.documentElement.dataset.preloaderDone = '1';
    /* La scène est déjà éteinte : on sort le canevas du compositeur.
       Il ne reste qu'un voile noir qui s'efface — coût nul. */
    if (this.cv) this.cv.style.display = 'none';
    document.body.classList.remove('pl-lock');
    document.dispatchEvent(new CustomEvent('preloader:done'));
  }

  finish(){
    this.done = true;
    this.release();
    cancelAnimationFrame(this.raf);
    this.pre.classList.add('is-done');
    this.pre.style.display = 'none';
    this.skip.remove();
    if (CONFIG.oncePerSession) sessionStorage.setItem('wb_intro', '1');
  }

  /* Sortie immédiate mais propre (clic, Échap, ou bouton Passer) */
  bail(instant){
    if (this.done) return;
    if (this.tl) this.tl.kill();
    gsap.to([this.pre, this.skip], { opacity:0, duration: instant ? 0 : .35 });
    gsap.delayedCall(instant ? 0 : .35, () => this.finish());
  }
}

/* ─────────────────── 8. AUDIO (optionnel, 100 % synthétisé) ───────────────────
   Aucun fichier à charger, aucune requête réseau. Ne démarre que si le
   visiteur a déjà interagi avec la page (politique autoplay des navigateurs). */
const Audio = {
  ctx:null,
  init(){
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    return this.ctx.state === 'running';
  },
  // Souffle filtré (bruit blanc + passe-bande qui balaie) → whoosh
  whoosh(t = 0, dur = 0.5, peak = 0.18){
    const c = this.ctx, n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.4;
    const g   = c.createGain();
    const now = c.currentTime + t;
    flt.frequency.setValueAtTime(320, now);
    flt.frequency.exponentialRampToValueAtTime(5200, now + dur * 0.8);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt).connect(g).connect(c.destination);
    src.start(now); src.stop(now + dur);
  },
  // Sub-bass descendante → impact
  boom(t = 0, from = 110, to = 32, dur = 1.1, peak = 0.3){
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const now = c.currentTime + t;
    o.type = 'sine';
    o.frequency.setValueAtTime(from, now);
    o.frequency.exponentialRampToValueAtTime(to, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(c.destination);
    o.start(now); o.stop(now + dur);
  },
  attach(tl){
    if (!this.init()) return;
    tl.call(() => this.whoosh(0, .45, .22), null, 1.00);  // la ligne
    tl.call(() => this.boom(0, 90, 34, .9, .22),  null, 1.06);  // l'impact
    tl.call(() => this.whoosh(0, .8, .10), null, 3.10);  // l'onde
    tl.call(() => this.whoosh(0, 1.1, .26),null, 4.00);  // le vortex
    tl.call(() => this.boom(0, 150, 26, 1.6, .34),null, 5.00);  // la lumière
  }
};

/* ─────────────────── 9. BOOT ─────────────────── */
function boot(){
  const pre  = document.getElementById('preloader');
  const skip = document.getElementById('skip');

  const bailOut = () => {
    pre.style.display = 'none';
    if (skip) skip.remove();
    document.body.classList.remove('pl-lock');
    /* Marqueur consultable : quand l'intro est court-circuitée, l'événement
       part avant que l'index ait pu s'y abonner. Le drapeau permet à un
       auditeur tardif de savoir que le signal est déjà passé. */
    document.documentElement.dataset.preloaderDone = '1';
    requestAnimationFrame(() =>
      document.dispatchEvent(new CustomEvent('preloader:done')));
  };

  // Fallbacks : mouvement réduit, session déjà vue, GSAP absent
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return bailOut();
  if (CONFIG.oncePerSession && sessionStorage.getItem('wb_intro')) return bailOut();
  if (typeof gsap === 'undefined'){ console.warn('[Preloader] GSAP introuvable.'); return bailOut(); }

  const seq = new Sequence();

  /* Gate de chargement réel — invisible. On attend les polices (sinon le
     logo serait échantillonné avec la mauvaise fonte) + le load window,
     avec un plafond de 2,5 s pour ne jamais bloquer le visiteur. */
  const fonts = document.fonts
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))])
    : Promise.resolve();

  const loaded = new Promise(r => {
    if (document.readyState === 'complete') r();
    else addEventListener('load', r, { once:true });
  });

  const ready = Promise.race([
    Promise.all([fonts, loaded]),
    new Promise(r => setTimeout(r, 2500))
  ]);

  seq.ready = false;
  ready.then(() => { seq.ready = true; });

  fonts.then(() => {
    seq.build();
    seq.play(ready);
  });

  // Sorties : bouton, Échap, double-clic
  skip.addEventListener('click', () => seq.bail(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') seq.bail(false); });
}

document.addEventListener('DOMContentLoaded', boot);

return { CONFIG };
})();
