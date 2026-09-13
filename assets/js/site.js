/* ═══════════════════════════════════════════════════════════════════════
   WEBOOST STUDIO — HERO
   Champ canvas calqué sur les courbes réelles de l'image :
     · ciel  — longues traînées en arc, gauche → droite
     · eau   — lignes basses + nœuds pulsés
     · ville — volontairement VIDE, le clocher doit rester net
   Teinte relevée sur la photo (R120 G167 B204) : le champ est bleu acier,
   le cyan pur reste réservé à l'UI.
   ═══════════════════════════════════════════════════════════════════════ */
const Hero = (() => {
'use strict';

const CFG = {
  sky:{ high:56, mid:36, low:20 },
  water:{ high:34, mid:22, low:12 },
  nodes:{ high:26, mid:16, low:9 },
  dprMax:1.5
};

const clamp = (v,a,b) => v<a?a:v>b?b:v;
const rand  = (a,b) => a + Math.random()*(b-a);
const EASE  = { cine: p => 1 - Math.pow(1-p,5.2) };   // identique au preloader

const tier = () => {
  const mem = navigator.deviceMemory||4, cores = navigator.hardwareConcurrency||4;
  if (innerWidth < 700 || mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4) return 'mid';
  return 'high';
};

function sprite(col){
  const c = document.createElement('canvas'); c.width = 256; c.height = 6;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0,0,256,0);
  gr.addColorStop(0,'rgba(0,0,0,0)');
  gr.addColorStop(.5,  col.replace('%A%','.05'));
  gr.addColorStop(.88, col.replace('%A%','.62'));
  gr.addColorStop(1,   col.replace('%A%','0'));
  g.fillStyle = gr; g.fillRect(0,2,256,2);
  g.fillStyle = col.replace('%A%','1'); g.fillRect(237,1.4,16,3.2);
  return c;
}
function dot(col){
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(24,24,0,24,24,24);
  gr.addColorStop(0, col.replace('%A%','1'));
  gr.addColorStop(.22, col.replace('%A%','.55'));
  gr.addColorStop(1, col.replace('%A%','0'));
  g.fillStyle = gr; g.fillRect(0,0,48,48);
  return c;
}
const SP = {
  steel: sprite('rgba(224,222,214,%A%)'),
  pale:  sprite('rgba(255,251,242,%A%)'),
  node:  dot('rgba(215,196,166,%A%)')
};

/* ───────── CHAMP DE FLUX ───────── */
class Field {
  constructor(cv){
    this.cv = cv;
    this.ctx = cv.getContext('2d',{ alpha:true, desynchronized:true });
    this.boost = 0; this.mv = 0; this.t = 0;
    const T = tier();
    this.nSky = CFG.sky[T]; this.nWater = CFG.water[T]; this.nNode = CFG.nodes[T];
    this.resize();
    this.sky   = Array.from({length:this.nSky},   () => this.mk('sky',   true));
    this.water = Array.from({length:this.nWater}, () => this.mk('water', true));
    this.nodes = Array.from({length:this.nNode},  () => this.mkNode());
  }

  resize(){
    this.w = this.cv.clientWidth; this.h = this.cv.clientHeight;
    this.dpr = Math.min(devicePixelRatio||1, CFG.dprMax);
    this.cv.width  = Math.round(this.w*this.dpr);
    this.cv.height = Math.round(this.h*this.dpr);
  }

  /* Chaque traînée suit sa propre sinusoïde très étirée : jamais
     rectiligne, jamais deux fois la même courbe. */
  mk(band, init){
    const sky = band === 'sky';
    return {
      band,
      x:  init ? rand(-0.2,1.1)*this.w : rand(-0.35,-0.08)*this.w,
      y0: sky ? rand(0.01,0.40)*this.h : rand(0.74,1.03)*this.h,
      amp: sky ? rand(18,95) : rand(4,20),
      k:   sky ? rand(0.7,1.9) : rand(1.4,3.2),
      ph:  rand(0,Math.PI*2),
      len: sky ? rand(120,420) : rand(90,300),
      th:  sky ? rand(.6,2.0) : rand(1.0,2.6),
      spd: sky ? rand(.5,2.1) : rand(.25,.9),
      a0:  sky ? rand(.12,.42) : rand(.14,.40),
      pale: Math.random() < 0.22
    };
  }
  mkNode(){
    return { x: rand(.03,.97)*this.w, y: rand(.76,1.0)*this.h,
             r: rand(1.4,4.2), a0: rand(.18,.55),
             sp: rand(.5,1.5), ph: rand(0,Math.PI*2) };
  }

  yAt(s){ return s.y0 + s.amp*Math.sin((s.x/this.w)*s.k*Math.PI + s.ph); }
  slopeAt(s){ return s.amp*Math.cos((s.x/this.w)*s.k*Math.PI + s.ph)*(s.k*Math.PI/this.w); }

  update(k){
    this.t += k/60;
    this.boost += (0-this.boost)*0.026*k;
    this.mv    += (0-this.mv)*0.055*k;
    const v = 1 + this.boost*6.5 + this.mv*3;
    for (const arr of [this.sky, this.water]){
      for (let i=0;i<arr.length;i++){
        const s = arr[i];
        s.x += s.spd*v*k;
        if (s.x - s.len > this.w + 60) arr[i] = this.mk(s.band, false);
      }
    }
  }

  draw(){
    const ctx = this.ctx, d = this.dpr, w = this.w;
    ctx.setTransform(d,0,0,d,0,0);
    ctx.clearRect(0,0,w,this.h);
    ctx.globalCompositeOperation = 'lighter';
    const stretch = 1 + this.boost*2 + this.mv*1.1;

    for (const arr of [this.sky, this.water]){
      for (const s of arr){
        const edge = Math.min(1, (s.x+s.len)/(w*0.18), (w*1.12-s.x)/(w*0.2));
        const a = s.a0 * clamp(edge,0,1) * (1 + this.boost*.8);
        if (a < 0.005) continue;
        const y = this.yAt(s);
        const ang = Math.atan(this.slopeAt(s));
        const L = s.len*stretch;
        const c = Math.cos(ang), sn = Math.sin(ang);
        ctx.setTransform(d*c, d*sn, -d*sn, d*c, d*s.x, d*y);
        ctx.globalAlpha = clamp(a,0,1);
        ctx.drawImage(s.pale ? SP.pale : SP.steel, -L, -s.th/2, L, s.th);
      }
    }

    ctx.setTransform(d,0,0,d,0,0);
    for (const n of this.nodes){
      const p = 0.45 + 0.55*Math.sin(this.t*n.sp + n.ph);
      const r = n.r*(1+p*.7)*3.2;
      ctx.globalAlpha = clamp(n.a0*p*(1+this.boost),0,1);
      ctx.drawImage(SP.node, n.x-r, n.y-r, r*2, r*2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}

/* ───────── PARALLAXE ───────── */
class Parallax {
  constructor(el){ this.el=el; this.x=0; this.y=0; this.tx=0; this.ty=0; }
  point(px,py){ this.tx=(px-.5)*24; this.ty=(py-.5)*14; }
  update(k){
    this.x += (this.tx-this.x)*0.055*k;
    this.y += (this.ty-this.y)*0.055*k;
    this.el.style.transform =
      `scale(1.05) translate3d(${(-this.x).toFixed(2)}px,${(-this.y).toFixed(2)}px,0)`;
  }
}

/* ───────── COMPTEURS ─────────
   data-fmt="eur" → séparateur de milliers français + symbole. */
function fmt(el, v){
  const dec = +(el.dataset.dec || 0);
  if (el.dataset.fmt === 'eur')
    return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  return v.toFixed(dec).replace('.', ',') + (el.dataset.suffix || '');
}
function countUp(el){
  const to = parseFloat(el.dataset.count), o = { v:0 };
  return gsap.to(o,{ v:to, duration:1.8, ease:'power3.out',
    onUpdate(){ el.textContent = fmt(el, o.v); } });
}

/* ───────── ENTRÉE ───────── */
function intro(field){
  const tl = gsap.timeline({ defaults:{ ease:EASE.cine } });
  field.boost = 1;

  tl.to('#field',{ opacity:1, duration:1.9, ease:'power2.out' },0)
    /* scale + opacity uniquement : composés par le GPU. Animer un
       filter:blur sur une image plein écran fait tomber le framerate. */
    .fromTo('#bg',{ scale:1.16, opacity:0 },
                  { scale:1.05, opacity:1, duration:2.4, ease:'power3.out' },0)
    .fromTo('.hero__title .line__in',
            { yPercent:112 },
            { yPercent:0, duration:1.4, stagger:.09 },.15)
    .to('.brand, .hero__place',{ opacity:1, y:0, duration:1.1, stagger:.08 },.05)
    .to('.hero__eyebrow',{ opacity:1, y:0, duration:1.0 },.3)
    .to('.hero__sub',    { opacity:1, y:0, duration:1.1 },.72)
    .to('.landmark',     { opacity:1, y:0, duration:1.3 },.9)
    .to('.hero__foot',   { opacity:1, y:0, duration:1.2 },1.0);
  return tl;
}

/* ───────── RÉVÉLATION AU SCROLL ─────────
   IntersectionObserver plutôt que ScrollTrigger : une dépendance de moins
   à charger, et on n'a besoin que d'un déclenchement unique par élément. */
function reveal(){
  const items = gsap.utils.toArray('[data-reveal]');
  gsap.set(items, { opacity:0, y:26 });

  gsap.set(gsap.utils.toArray('.sec-title .line__in'), { yPercent:112 });

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);

      if (e.target.classList.contains('sec-title')){
        gsap.to(e.target.querySelectorAll('.line__in'),
          { yPercent:0, duration:1.3, ease:EASE.cine, stagger:.09 });
      } else {
        gsap.to(e.target, { opacity:1, y:0, duration:1.1, ease:EASE.cine });
        // Le prix se compose au moment où la carte arrive
        const price = e.target.querySelector('[data-count]');
        if (price) countUp(price);
      }
    });
  }, { threshold:.18, rootMargin:'0px 0px -8% 0px' });

  items.forEach(el => io.observe(el));
  document.querySelectorAll('.sec-title').forEach(el => io.observe(el));
}

/* ───────── RÉALISATIONS — LE SOMMAIRE ─────────
   Une ligne par projet, la planche d'aperçu à droite, et la démo en plein
   écran à la demande. Rien n'est piloté par le scroll : c'est ce qui rend
   la section indépendante du nombre de projets — trois lignes ou trente,
   même hauteur, et personne n'est obligé de traverser le portfolio.

   Volontairement hors de init() : celui-ci rend la main en mouvement
   réduit, et le sommaire, lui, doit rester utilisable dans tous les cas. */
function worksIndex(){
  const idx = document.getElementById('idx');
  const demo = document.getElementById('demo');
  if (!idx || !demo) return;

  const rows   = Array.from(idx.querySelectorAll('.idx__row'));
  const sheets = Array.from(document.querySelectorAll('.plate__sheet'));
  const descs  = Array.from(document.querySelectorAll('.plate__desc > div'));
  if (!rows.length) return;

  const stage  = document.getElementById('demo-stage');
  const img    = document.getElementById('demo-img');
  const scroll = document.getElementById('demo-scroll');
  const swap   = document.getElementById('demo-swap');
  const closeB = document.getElementById('demo-close');
  const elName = document.getElementById('demo-name');
  const elJob  = document.getElementById('demo-job');
  const elCap  = document.getElementById('demo-cap');
  const elLink = document.getElementById('demo-link');

  /* ── Aperçu au survol ── */
  /* Relancer une animation CSS depuis le début : on la coupe, on force un
     recalcul, on rend la main à la feuille de style. */
  const rewind = im => {
    if (!im) return;
    im.style.animation = 'none';
    void im.offsetWidth;
    im.style.animation = '';
  };

  let active = 0;
  const show = i => {
    if (i === active) return;                 // pas de relance sur soi-même
    active = i;
    rows.forEach((r,k)   => r.classList.toggle('is-on', k === i));
    sheets.forEach((s,k) => s.classList.toggle('is-on', k === i));
    descs.forEach((d,k)  => d.classList.toggle('is-on', k === i));
    /* On remet à zéro la planche qui ARRIVE, jamais celle qui part : celle-ci
       est encore visible le temps de son fondu, elle ressauterait en haut. La
       nouvelle, elle, est à peine opaque au moment de la remise à zéro. */
    rewind(sheets[i] && sheets[i].querySelector('img'));
    applyPlay();
  };
  rows.forEach((r,i) => {
    const btn = r.querySelector('.idx__btn');
    r.addEventListener('pointerenter', () => show(i));
    btn.addEventListener('focus', () => show(i));
    btn.addEventListener('click', () => open(i));
  });

  /* Dérive de l'aperçu : on fixe la vitesse, pas la durée. Les trois
     captures n'ont pas la même hauteur — à durée commune, la plus longue
     défilait presque deux fois plus vite que la plus courte. */
  const DRIFT_SPEED = 62;                       // pixels par seconde
  const win = document.querySelector('.plate__win');

  /* La hauteur d'affichage est déduite des dimensions connues de la capture,
     pas de offsetHeight : les planches 2 et suivantes n'ont pas encore de
     `src` au démarrage, et un navigateur qui ne leur donne alors aucune
     hauteur ramenait leur course à zéro — l'animation tournait sur une
     distance nulle, donc rien ne bougeait. Avec data-dw / data-dh, le calcul
     est exact avant même que l'image n'arrive, et identique partout. */
  const setDrift = () => {
    if (!win) return;
    const w = win.clientWidth, h = win.clientHeight;
    sheets.forEach((sh, k) => {
      const im = sh.querySelector('img'), row = rows[k];
      if (!im) return;
      const dw = row && +row.dataset.dw, dh = row && +row.dataset.dh;
      const shown = (dw && dh) ? w * dh / dw : im.offsetHeight;
      const travel = Math.max(0, shown - h);
      im.style.setProperty('--drift', travel.toFixed(0));
      im.style.setProperty('--drift-t', Math.max(6, travel / DRIFT_SPEED).toFixed(1) + 's');
    });
  };

  /* Lecture posée en ligne, planche par planche : voir le commentaire de la
     feuille de style — une bascule paused → running par changement de classe
     sur un ancêtre n'est pas fiable sur WebKit. */
  let seen = false;
  const applyPlay = () => sheets.forEach((sh, k) => {
    const im = sh.querySelector('img');
    if (im) im.style.animationPlayState = (seen && k === active) ? 'running' : 'paused';
  });

  setDrift();
  /* Un changement de --drift n'est pas repris par une animation déjà lancée :
     on la recrée pour que la nouvelle course soit prise en compte. */
  addEventListener('resize', () => {
    setDrift();
    rewind(sheets[active] && sheets[active].querySelector('img'));
    applyPlay();
  }, { passive:true });

  /* Les planches 2 et 3 n'arrivent qu'à l'approche de la section : trois
     captures pleine page, ce n'est pas gratuit sur un forfait mobile. */
  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return;
    o.disconnect();
    sheets.forEach(s => {
      const im = s.querySelector('img');
      if (!im || !im.dataset.src) return;
      im.src = im.dataset.src;
      delete im.dataset.src;
      // Le src n'est posé que maintenant : c'est ici qu'on peut écouter sa
      // fin de chargement, pas au démarrage où `complete` vaut déjà true
      // pour une image sans source.
      im.addEventListener('load', () => { setDrift(); applyPlay(); }, { once:true });
    });
  }, { rootMargin:'400px' }).observe(idx);

  /* La dérive ne démarre qu'à l'arrivée du visiteur sur la section. Lancée au
     chargement, la première planche aurait déjà descendu la page avant même
     d'être regardée. */
  const plate = document.querySelector('.plate');
  if (plate){
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      seen = true;
      setDrift();
      rewind(sheets[active] && sheets[active].querySelector('img'));
      applyPlay();
    }, { threshold:.25 }).observe(plate);
  }

  /* ── La démo ── */
  let cur = null, fmt = 'desktop', lastFocus = null;

  const paint = (next, keepPlace) => {
    if (!cur) return;
    /* On garde la position relative dans la page en changeant de format :
       repartir en haut ferait perdre l'endroit qu'on était en train de lire. */
    const max = scroll.scrollHeight - scroll.clientHeight;
    const ratio = keepPlace && max > 0 ? scroll.scrollTop / max : 0;
    fmt = next;
    const phone = fmt === 'mobile';
    stage.style.setProperty('--stage-w', phone ? '390px' : '1180px');
    stage.style.setProperty('--stage-r', phone ? '26px' : '6px');
    img.width  = +cur.dataset[phone ? 'mw' : 'dw'];
    img.height = +cur.dataset[phone ? 'mh' : 'dh'];
    img.src = `assets/img/demo-${cur.dataset.slug}-${fmt}.webp`;
    img.alt = `Le site ${cur.dataset.name}, page entière, version ${phone ? 'mobile' : 'desktop'}`;
    elCap.textContent = `Capture réelle · page entière · ${phone ? 'mobile 390 px' : 'desktop 1440 px'}`;
    Array.from(swap.children).forEach(b => b.classList.toggle('is-on', b.dataset.fmt === fmt));
    requestAnimationFrame(() => {
      const m = scroll.scrollHeight - scroll.clientHeight;
      scroll.scrollTop = ratio * m;
    });
  };

  function open(i){
    cur = rows[i];
    lastFocus = document.activeElement;
    demo.style.setProperty('--pacc', getComputedStyle(cur).getPropertyValue('--pacc'));
    elName.innerHTML = `${cur.dataset.name} <span class="demo__badge">Démonstration</span>`;
    elJob.textContent = cur.dataset.job;
    elLink.href = cur.dataset.url;
    demo.hidden = false;
    paint('desktop', false);
    scroll.scrollTop = 0;
    requestAnimationFrame(() => demo.classList.add('is-on'));
    document.body.style.overflow = 'hidden';
    closeB.focus();
  }
  const close = () => {
    demo.classList.remove('is-on');
    document.body.style.overflow = '';
    setTimeout(() => { demo.hidden = true; img.removeAttribute('src'); }, 300);
    if (lastFocus) lastFocus.focus();
  };

  closeB.addEventListener('click', close);
  demo.addEventListener('click', e => { if (e.target === demo) close(); });
  swap.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) paint(b.dataset.fmt, true);
  });
  addEventListener('keydown', e => {
    if (demo.hidden) return;
    if (e.key === 'Escape'){ close(); return; }
    if (e.key !== 'Tab') return;
    // Tant que la démo est ouverte, le clavier n'en sort pas
    const f = demo.querySelectorAll('button, a[href]');
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}
document.addEventListener('DOMContentLoaded', worksIndex);










/* ───────── CARTE DU GOLFE ─────────
   Chaque contour a sa longueur propre : sans la mesurer, Rayol-Canadel
   se dessinerait en un éclair pendant que Ramatuelle prendrait 3 s. */
function golfeMap(){
  const box = document.getElementById('golfe');
  const cap = document.getElementById('cap');
  if (!box) return;

  const shapes = Array.from(box.querySelectorAll('.cm'));
  shapes.forEach(s => {
    const p = s.querySelector('.cm__line');
    p.style.setProperty('--len', p.getTotalLength().toFixed(0));
  });

  new IntersectionObserver((es, o) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      o.disconnect();
      box.classList.add('is-draw', 'is-on');
    });
  }, { threshold:.22 }).observe(box);

  if (!cap) return;
  const labs = Array.from(box.querySelectorAll('.cm__lab'));
  const n = document.getElementById('cap-n'), p = document.getElementById('cap-p');
  const go = document.getElementById('cap-go');
  const base = { n:n.textContent, p:p.textContent, h:go.getAttribute('href') || '' };
  let cur = base.n, timer = null;

  const set = (name, prof, href) => {
    if (name === cur) return;
    cur = name;
    cap.classList.add('is-swap');
    clearTimeout(timer);
    timer = setTimeout(() => {
      n.textContent = name; p.textContent = prof;
      /* Pas de page pour cette commune : on masque le lien plutôt que
         d'envoyer le visiteur — et Google — sur une 404. */
      if (href){ go.href = href; go.hidden = false; } else { go.hidden = true; }
      cap.classList.remove('is-swap');
    }, 190);
  };

  shapes.forEach((s, i) => {
    const on = () => {
      labs.forEach((l, j) => l.classList.toggle('is-hot', j === i));
      set(s.dataset.n, s.dataset.p, s.getAttribute('href'));
    };
    s.addEventListener('pointerenter', on);
    s.addEventListener('focus', on);
  });
  box.addEventListener('pointerleave', () => {
    labs.forEach(l => l.classList.remove('is-hot'));
    set(base.n, base.p, base.h);
  });
}

/* ───────── LECTURE PROGRESSIVE DU « À PROPOS » ─────────
   Le texte est découpé en mots au chargement, puis chaque mot s'allume
   à mesure que le bloc traverse la zone de lecture. On ne touche que les
   mots dont l'état change : sur 150 spans, réécrire tout à chaque frame
   coûterait cher pour rien. */
function aboutRead(){
  const root = document.querySelector('.about-text');
  if (!root || matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  /* Découpage par nœuds de texte : les <b> et les liens restent intacts */
  const words = [];
  root.querySelectorAll('p').forEach(p => {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(tn => {
      const frag = document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)){ frag.appendChild(document.createTextNode(tok)); return; }
        const s = document.createElement('span');
        s.className = 'w'; s.textContent = tok;
        frag.appendChild(s); words.push(s);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  });
  if (!words.length) return;

  let lit = 0, ticking = false;

  const apply = () => {
    ticking = false;
    const r = root.getBoundingClientRect();
    const start = innerHeight * 0.84;          // le mot s'allume en montant
    const end   = innerHeight * 0.30;
    const total = r.height + (start - end);
    const p = clamp((start - r.top) / (total || 1), 0, 1);

    // Petite avance et un dépassement en fin : le dernier mot s'allume
    // avant que le bloc ne quitte l'écran
    const n = clamp(Math.round(p * (words.length + 10) - 4), 0, words.length);
    if (n === lit) return;
    if (n > lit) for (let i = lit; i < n; i++) words[i].classList.add('is-lit');
    else         for (let i = n; i < lit; i++) words[i].classList.remove('is-lit');
    lit = n;
  };

  const onScroll = () => { if (!ticking){ ticking = true; requestAnimationFrame(apply); } };
  addEventListener('scroll', onScroll, { passive:true });
  addEventListener('resize', onScroll, { passive:true });
  apply();
}

/* ───────── COLONNE DE SERVICES ─────────
   Chaque motif est mesuré une fois, puis se trace à l'entrée de sa ligne.
   getTotalLength() peut renvoyer 0 avant mesure : on réessaie, sinon un
   dasharray nul afficherait le tracé plein d'emblée. */
function services(){
  const lignes = Array.from(document.querySelectorAll('#col .cl'));
  if (!lignes.length) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  let essais = 0;
  const armer = () => {
    const traces = lignes.flatMap(l => Array.from(l.querySelectorAll('path,rect,circle')));
    const longs = traces.map(t => (t.getTotalLength ? t.getTotalLength() : 0));
    if (longs.some(l => !l) && essais++ < 60){ requestAnimationFrame(armer); return; }

    lignes.forEach(l => {
      Array.from(l.querySelectorAll('path,rect,circle')).forEach((t, i) => {
        const L = t.getTotalLength ? t.getTotalLength() : 400;
        t.style.setProperty('--l', L.toFixed(0));
        t.style.setProperty('--i', i);
      });
      l.classList.add('is-armed');
    });

    const io = new IntersectionObserver((es, o) => {
      es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('is-on'); o.unobserve(e.target); } });
    }, { threshold:.35, rootMargin:'0px 0px -8% 0px' });
    lignes.forEach(l => io.observe(l));
  };
  armer();
}

/* ───────── PORTRAIT ─────────
   Le volet monte de 0 à 100 % sur 1,6 s ; le masque CSS suit la même
   variable que le trait laiton, donc les deux ne peuvent pas se désynchroniser.
   Animer une variable plutôt que deux propriétés évite tout décalage. */
function portrait(){
  const el = document.getElementById('portrait');
  if (!el) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches){
    el.style.setProperty('--rv', '100%'); return;
  }
  const run = () => {
    el.classList.add('is-scanning');
    const t0 = performance.now(), D = 1600;
    const step = now => {
      const p = Math.min(1, (now - t0) / D);
      // Départ franc, arrivée qui glisse
      const e = 1 - Math.pow(1 - p, 3.2);
      el.style.setProperty('--rv', (e * 100).toFixed(2) + '%');
      if (p < 1) requestAnimationFrame(step);
      else { el.classList.remove('is-scanning'); el.classList.add('is-on'); }
    };
    requestAnimationFrame(step);
  };
  new IntersectionObserver((es, o) => {
    es.forEach(e => { if (e.isIntersecting){ o.disconnect(); run(); } });
  }, { threshold:.3 }).observe(el);
}

/* ───────── FORMULAIRE ─────────
   Envoi vers contact.php sans quitter la page : le script répond en JSON,
   on affiche son message tel quel. La commune est ajoutée en tête du
   message, le script PHP ne connaissant pas ce champ. */
function contact(){
  const f = document.getElementById('form');
  if (!f) return;
  const etat = document.getElementById('form-status');
  const btn  = f.querySelector('.submit');

  const dire = (txt, ok) => {
    etat.textContent = txt;
    etat.className = 'form-status ' + (ok ? 'ok' : 'ko');
    etat.hidden = false;
  };

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!f.reportValidity()) return;

    const d = new FormData(f);
    const ville = (d.get('ville') || '').trim();
    if (ville) d.set('message', 'Commune : ' + ville + '\n\n' + (d.get('message') || ''));
    d.delete('ville'); d.delete('consentement');

    btn.disabled = true;
    const libelle = btn.textContent;
    btn.textContent = 'Envoi…';
    try {
      const r = await fetch(f.action, { method:'POST', body:d,
                                        headers:{ 'Accept':'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success){
        dire(j.message || 'Message envoyé. Réponse sous 24 heures.', true);
        f.reset();
      } else {
        dire(j.message || 'L’envoi a échoué. Écrivez à contact@weboost-studio.fr ou appelez le 06 69 37 16 67.', false);
      }
    } catch {
      /* Réseau coupé ou script absent : on ne laisse jamais le visiteur sans issue */
      dire('L’envoi a échoué. Écrivez à contact@weboost-studio.fr ou appelez le 06 69 37 16 67.', false);
    } finally {
      btn.disabled = false; btn.textContent = libelle;
    }
  });
}

/* ───────── NAVIGATION ─────────
   Cachée sur le hero, elle descend une fois la première image dépassée et
   se rétracte quand on remonte vers le haut. La section courante est
   soulignée. Un seul écouteur de défilement, cadencé par rAF. */
function nav(){
  const bar = document.getElementById('nav');
  if (!bar) return;
  const burger = document.getElementById('nav-burger');
  const menu = document.getElementById('nav-menu');
  const liens = Array.from(bar.querySelectorAll('.nav__links a'));
  const cibles = liens.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  let dernier = 0, tick = false, ouvert = false;
  const maj = () => {
    tick = false;
    const y = scrollY;
    /* On la montre passé un écran, et on la masque tant qu'on descend :
       la barre ne doit jamais couvrir ce qu'on est en train de lire. */
    const seuil = innerHeight * 0.85;
    bar.classList.toggle('is-on', y > seuil && (y < dernier || y < seuil + 80));
    dernier = y;

    let actif = -1;
    cibles.forEach((c, i) => { if (c.getBoundingClientRect().top <= innerHeight * 0.35) actif = i; });
    liens.forEach((a, i) => a.classList.toggle('is-here', i === actif));
  };
  addEventListener('scroll', () => { if (!tick){ tick = true; requestAnimationFrame(maj); } },
                   { passive:true });
  maj();

  if (!burger || !menu) return;
  const bascule = etat => {
    ouvert = etat;
    burger.setAttribute('aria-expanded', etat ? 'true' : 'false');
    burger.setAttribute('aria-label', etat ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = etat ? 'hidden' : '';
    if (etat){ menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-on')); }
    else { menu.classList.remove('is-on'); setTimeout(() => { if (!ouvert) menu.hidden = true; }, 400); }
  };
  burger.addEventListener('click', () => bascule(!ouvert));
  menu.addEventListener('click', e => { if (e.target.tagName === 'A') bascule(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && ouvert) bascule(false); });
}

/* ───────── BANDE VIDÉO ─────────
   Les sources ne sont montées qu'à l'approche de l'écran : tant que le
   visiteur n'est pas descendu, la page ne télécharge pas un octet de vidéo.
   La lecture s'arrête dès que la bande sort du champ — inutile de décoder
   des images que personne ne regarde. */
function film(){
  const sec = document.getElementById('film');
  const v = document.getElementById('film-v');
  if (!sec || !v) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  let monte = false;
  const monter = () => {
    if (monte) return;
    monte = true;
    [['assets/video/golfe.webm','video/webm'],
     ['assets/video/golfe.mp4','video/mp4']].forEach(([src,type]) => {
      const s = document.createElement('source');
      s.src = src; s.type = type; v.appendChild(s);
    });
    if (v.dataset.poster) v.poster = v.dataset.poster;
    v.load();
    v.addEventListener('loadeddata', () => sec.classList.add('is-on'), { once:true });
  };

  new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting){ monter(); v.play().catch(() => {}); }
      else if (monte) v.pause();
    });
  }, { rootMargin:'200px 0px' }).observe(sec);
}

/* ───────── BOOT ─────────
   Rien de lourd ne démarre avant la fin du preloader : sinon le champ du
   hero, la côte du portfolio et la mesure des tracés de la carte tournent
   en même temps que les 5 200 particules de l'intro, et tout saccade. */
function init(){
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const gated  = document.body.dataset.preloader === 'on';

  if (reduce || typeof gsap === 'undefined'){
    document.querySelectorAll('[data-count]').forEach(el => {
      el.textContent = fmt(el, parseFloat(el.dataset.count));
    });
    document.querySelectorAll('.js-fade').forEach(el => el.style.opacity = 1);
    document.querySelectorAll('.line__in').forEach(el => el.style.transform = 'none');
    const bg = document.getElementById('bg');
    if (bg) bg.style.opacity = 1;
    return;
  }

  gsap.set('.js-fade',{ y:16 });
  contact();
  nav();
  film();

  /* Tout le poids est ici, et il n'est appelé qu'au feu vert */
  const start = () => {
    /* Sur cette frame, uniquement ce qui est visible : le champ du hero et
       son entrée. reveal() pose l'état masqué sur une trentaine d'éléments
       et crée autant d'observateurs — sur une page de cette longueur, ça
       force un calcul de mise en page complet qu'on ne peut pas se payer
       au moment précis où le rideau se lève. */
    const field = new Field(document.getElementById('field'));
    const para  = new Parallax(document.getElementById('bg'));

    let last = performance.now(), running = true;
    const loop = now => {
      if (!running) return;
      requestAnimationFrame(loop);
      const k = clamp((now-last)/16.667,.2,3); last = now;
      field.update(k); field.draw(); para.update(k);
    };
    requestAnimationFrame(loop);

    addEventListener('pointermove', e => {
      field.mv = clamp(field.mv + Math.abs(e.movementX||0)*0.005, 0, 1.1);
      para.point(e.clientX/innerWidth, e.clientY/innerHeight);
    }, { passive:true });

    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running){ running = true; last = performance.now(); requestAnimationFrame(loop); }
      else if (!e.isIntersecting) running = false;
    }).observe(document.getElementById('hero'));

    addEventListener('resize', () => field.resize(), { passive:true });

    services();   /* visible dès le second écran : pas de report */
    intro(field);

    /* Le portfolio et la carte du golfe sont loin sous la ligne de
       flottaison : on les monte pendant un temps mort du processeur,
       jamais dans la frame de l'arrivée. */
    /* Le reste part sur un temps mort du processeur : rien de tout cela
       n'est visible tant qu'on n'a pas commencé à descendre. */
    const later = () => { reveal(); portrait(); golfeMap(); aboutRead(); };
    if ('requestIdleCallback' in window) requestIdleCallback(later, { timeout:1400 });
    else setTimeout(later, 700);
  };

  if (!gated) { setTimeout(start, 120); return; }
  /* Si l'intro a déjà rendu la main — rejeu unique, mouvement réduit,
     bouton Passer — l'événement est passé : on démarre sans l'attendre. */
  if (document.documentElement.dataset.preloaderDone === '1') setTimeout(start, 0);
  else document.addEventListener('preloader:done', start, { once:true });
}

document.addEventListener('DOMContentLoaded', init);
return { init };
})();
