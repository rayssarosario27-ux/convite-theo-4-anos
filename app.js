(function () {
  'use strict';

  /* ===== CONFIGURAÇÃO (edite aqui) ===== */
  var CONFIG = {
    // WhatsApp que recebe as confirmações de presença (só dígitos, com DDI+DDD).
    whatsapp: '5521976902045',
    // 13 de dezembro de 2026, 15h, horário de Brasília (UTC-3)
    eventISO: '2026-12-13T15:00:00-03:00',
    guestMsg: 'Olá! Confirmo presença no aniversário de 4 anos do Théo (13/12, 15h, Salão Espaço Magnata).',
    siteUrl: '',
    place: 'Salão Espaço Magnata, Rua E, 5, Cosmos'
  };

  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var wa = (CONFIG.whatsapp || '').replace(/\D/g, '');

  /* ===== TOAST ===== */
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ===== ÁUDIO: trilha original sintetizada (Web Audio), só após toque ===== */
  var Audio = (function () {
    var ctx, master, timer, step = 0, nextT = 0, playing = false, on = true;
    var BPM = 116, SP = 60 / BPM / 2; // colcheias; trilha heroica original, tom de Ré maior
    var F = { G2: 98, A2: 110, B2: 123.47, D3: 146.83, G3: 196, A3: 220, B3: 246.94, D4: 293.66, 'F#3': 185, 'C#4': 277.18, E4: 329.63, 'F#4': 369.99, G4: 392, A4: 440, B4: 493.88, 'C#5': 554.37, D5: 587.33, E5: 659.25, 'F#5': 739.99, A5: 880 };
    var chords = [[['B2', 'D3', 'F#3', 'B3'], 'B2'], [['G2', 'B3', 'D4', 'G3'], 'G2'], [['D3', 'A3', 'D4', 'F#4'], 'D3'], [['A2', 'E4', 'A3', 'C#4'], 'A2']];
    var mel = [
      ['B4', 0, 'D5', 0, 'F#5', 0, 'E5', 'D5', 'B4', 0, 'D5', 'F#5', 'A5', 0, 'F#5', 0],
      ['G4', 0, 'B4', 0, 'D5', 0, 'E5', 'D5', 'B4', 0, 'G4', 'B4', 'D5', 0, 'E5', 0],
      ['A4', 0, 'D5', 0, 'F#5', 0, 'A5', 0, 'F#5', 'E5', 'D5', 0, 'A4', 0, 'D5', 0],
      ['E5', 0, 'C#5', 0, 'E5', 'F#5', 'E5', 0, 'C#5', 0, 'A4', 'C#5', 'E5', 'A5', 'F#5', 'E5']];
    function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    function tone(f, t, dur, type, vol, dest) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      env(g, t, 0.01, dur, vol); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
    }
    function kick(t) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      env(g, t, 0.005, 0.18, 0.9); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    }
    var noiseBuf;
    function hat(t, open) {
      if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000; env(g, t, 0.002, open ? 0.12 : 0.04, 0.25);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.2);
    }
    function snare(t) {
      hat(t, true); tone(190, t, 0.08, 'triangle', 0.3);
    }
    function pad(freqs, t, dur) {
      var f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 1300; g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.5); g.gain.setValueAtTime(0.11, t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      f.connect(g); g.connect(master);
      freqs.forEach(function (fr, i) { [-6, 6].forEach(function (dt) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = F[fr]; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.1); }); });
    }
    function brass(fr, t, dur, vol) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = fr; o2.frequency.value = fr; o2.detune.value = 8;
      f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.08); f.frequency.exponentialRampToValueAtTime(1400, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function timp(t, v) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.2);
      env(g, t, 0.005, 0.5, v); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
    }
    var ducked = false;
    function mus() { return document.getElementById('music'); }
    function musicVol() { var m = mus(); if (!m) return; m.muted = !on; m.volume = ducked ? 0.14 : 0.55; }
    function startMusic() { var m = mus(); if (!m) return; musicVol(); var p = m.play(); if (p && p.catch) p.catch(function () {}); }
    function sched() {
      while (nextT < ctx.currentTime + 0.3) {
        var s = step % 64, ci = Math.floor(s / 16), k = s % 16, t = nextT, C = chords[ci];
        if (k === 0) { pad(C[0], t, SP * 16 + 0.2); hat(t, true); hat(t, true); }
        if (k % 4 === 0) timp(t, k === 0 ? 0.9 : 0.55);
        if (k === 4 || k === 12) snare(t);
        if (k % 2 === 1 && k > 8) hat(t, false);
        if (k % 2 === 0) tone(F[C[1]] , t, SP * 1.8, 'triangle', 0.2);
        var L = mel[ci][k];
        if (L) brass(F[L], t, SP * 1.9, 0.11);
        nextT += SP; step++;
      }
    }
    return {
      start: function () {
        if (playing) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = ctx || new AC();
        if (ctx.state === 'suspended') ctx.resume();
        master = master || ctx.createGain(); master.gain.value = on ? 0.55 : 0; master.connect(ctx.destination);
        playing = true; startMusic();
      },
      toggle: function () {
        on = !on; musicVol();
        if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
        if (on && !playing && ctx) this.start();
        return on;
      },
      sfx: function (kind) {
        if (!ctx || !on) return;
        var t = ctx.currentTime;
        if (kind === 'pop') { tone(660, t, 0.12, 'square', 0.12); tone(990, t + 0.07, 0.14, 'square', 0.1); }
        else if (kind === 'web') { tone(1400, t, 0.18, 'sawtooth', 0.05); tone(700, t + 0.05, 0.2, 'triangle', 0.08); }
        else if (kind === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.09, 0.3, 'square', 0.1); }); }
        else if (kind === 'whoosh') { tone(300, t, 0.5, 'sawtooth', 0.05); }
      },
      pause: function () { if (ctx && playing) { ctx.suspend(); } try { mus().pause(); } catch (e) {} },
      resume: function () { if (ctx && playing) { ctx.resume(); } if (playing && on) { try { mus().play(); } catch (e) {} } },
      isOn: function () { return on; },
      isPlaying: function () { return playing; },
      duck: function (d) { ducked = d; musicVol(); if (master && on) master.gain.setTargetAtTime(d ? 0.2 : 0.55, ctx.currentTime, 0.2); },
      setOn: function (v) { on = v; musicVol(); if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }
    };
  })();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) Audio.pause(); else Audio.resume();
  });

  /* ===== TEIAS (SVG) ===== */
  function webSVG(sizeClass) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    svg.setAttribute('class', 'w ' + (sizeClass || ''));
    var n = 10, i, j, d = '';
    for (i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + 0.2;
      d += 'M0 0L' + (Math.cos(a) * 95).toFixed(1) + ' ' + (Math.sin(a) * 95).toFixed(1);
    }
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'r1'); p.setAttribute('pathLength', '1'); svg.appendChild(p);
    var rings = '';
    [25, 50, 75, 95].forEach(function (r) {
      for (j = 0; j <= n; j++) {
        var a1 = (j / n) * Math.PI * 2 + 0.2, a2 = ((j + 0.5) / n) * Math.PI * 2 + 0.2;
        var x = Math.cos(a1) * r, y = Math.sin(a1) * r;
        if (j === 0) rings += 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
        else rings += 'Q' + (Math.cos(a2 - Math.PI * 2 / n / 2 + Math.PI * 2 / n / 2) * r * 0.86).toFixed(1) + ' ' + (Math.sin(a2 - Math.PI * 2 / n / 2 + Math.PI * 2 / n / 2) * r * 0.86).toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
      }
    });
    var q = document.createElementNS(NS, 'path'); q.setAttribute('d', rings); q.setAttribute('class', 'r2'); q.setAttribute('pathLength', '1'); svg.appendChild(q);
    return svg;
  }
  function spawnWeb(x, y) {
    var layer = $('webLayer'), s = webSVG();
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.transform = 'rotate(' + Math.round(Math.random() * 60 - 30) + 'deg)';
    layer.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 2300);
    Audio.sfx('web');
    burst(x, y, 10);
  }

  /* ===== CONFETES / PARTÍCULAS (canvas) ===== */
  var cv, cx, parts = [], raf = 0;
  function initCanvas() {
    cv = $('fx'); cx = cv.getContext('2d');
    function rs() { var r = Math.min(window.devicePixelRatio || 1, 2); cv.width = innerWidth * r; cv.height = innerHeight * r; cx.setTransform(r, 0, 0, r, 0, 0); }
    rs(); addEventListener('resize', rs);
  }
  var COLORS = ['#e11d2e', '#2d6bff', '#ffc400', '#27c24c', '#ffffff'];
  function setColors(c) { COLORS = c.concat(['#ffffff']); }
  function burst(x, y, n, power) {
    if (reduce) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (power || 5) * (0.4 + Math.random());
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.18, life: 70 + Math.random() * 40, c: COLORS[(Math.random() * COLORS.length) | 0], s: 4 + Math.random() * 6, r: Math.random() * 6, vr: Math.random() * 0.4 - 0.2 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function confettiRain(n) {
    if (reduce) return;
    for (var i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: Math.random() * 2 - 1, vy: 2 + Math.random() * 3, g: 0.02, life: 200, c: COLORS[(Math.random() * COLORS.length) | 0], s: 6 + Math.random() * 6, r: 0, vr: Math.random() * 0.3 - 0.15 });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.r += p.vr; p.life--;
      if (p.life <= 0 || p.y > innerHeight + 30) { parts.splice(i, 1); continue; }
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.min(1, p.life / 30);
      cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* ===== HERÓIS (escolha, tema, mensagens) ===== */
  var HEROES = {
    spider: { name: 'Homem-Aranha', img: 'spider.webp', msg: 'Sua missão é lançar teias e salvar a festa!', c: ['#e11d2e', '#2d6bff'], vars: { '--gold': '#ffc400', '--gold2': '#c98a00', '--blue': '#2d6bff', '--blue2': '#143fb8' } },
    iron:   { name: 'Homem de Ferro', img: 'iron.webp', msg: 'Sua missão é ligar os propulsores e deixar a festa com muita tecnologia!', c: ['#ffc400', '#e11d2e'], vars: { '--gold': '#ffd23f', '--gold2': '#d4900a', '--blue': '#d62839', '--blue2': '#8e1220' } },
    hulk:   { name: 'Hulk', img: 'hulk.webp', msg: 'Sua missão é fazer a maior festa esmagadora de alegria!', c: ['#27c24c', '#8b4de8'], vars: { '--gold': '#7be04a', '--gold2': '#3e9a1e', '--blue': '#8b4de8', '--blue2': '#5226a8' } },
    thor:   { name: 'Thor', img: 'thor.webp', msg: 'Sua missão é trazer o trovão e muita diversão para a festa!', c: ['#4aa8ff', '#ffd23f'], vars: { '--gold': '#ffe066', '--gold2': '#c9a000', '--blue': '#3d8bff', '--blue2': '#1a54b8' } },
    widow:  { name: 'Viúva Negra', img: 'widow.webp', msg: 'Sua missão é agir com coragem e proteger a festa!', c: ['#ff3cac', '#35e6ff'], vars: { '--gold': '#ff6cc4', '--gold2': '#9a2a74', '--blue': '#c2185b', '--blue2': '#7a0f3a' } },
    marvel: { name: 'Capitã Marvel', img: 'marvel.webp', msg: 'Sua missão é voar alto e levar energia para a festa!', c: ['#ffc400', '#2d6bff'], vars: { '--gold': '#ffd23f', '--gold2': '#c98a00', '--blue': '#d62839', '--blue2': '#8e1220' } },
    cap:    { name: 'Capitão América', img: 'cap.webp', msg: 'Sua missão é proteger a turma e liderar a diversão!', c: ['#2d6bff', '#e11d2e'], vars: { '--gold': '#ffffff', '--gold2': '#aab6d6', '--blue': '#2d6bff', '--blue2': '#143fb8' } }
  };
  var heroKey = 'spider', userName = '';
  try { userName = localStorage.getItem('theo4.name') || ''; var hk = localStorage.getItem('theo4.hero'); if (hk && HEROES[hk]) heroKey = hk; } catch (e) {}
  function applyHero(k, fx) {
    heroKey = k; var H = HEROES[k];
    Object.keys(H.vars).forEach(function (v) { document.documentElement.style.setProperty(v, H.vars[v]); });
    document.body.setAttribute('data-hero', k);
    setColors(H.c);
    document.querySelectorAll('[data-heromsg]').forEach(function (e) { e.textContent = H.msg; });
    document.querySelectorAll('.hp').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.k === k ? 'true' : 'false'); });
    document.querySelectorAll('.h').forEach(function (im) { im.classList.toggle('chosen', im.className.indexOf('h-' + (k === 'iron' ? 'iron' : k === 'cap' ? 'cap' : k)) > -1); });
    try { localStorage.setItem('theo4.hero', k); } catch (e) {}
    if (fx) { burst(innerWidth / 2, innerHeight / 2, 40, 7); Audio.sfx('pop'); }
    drawBadge($('badgeCv'));
  }
  function buildPickers() {
    document.querySelectorAll('[data-picker]').forEach(function (box) {
      box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'Escolha seu herói');
      Object.keys(HEROES).forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'hp'; b.dataset.k = k; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        var im = document.createElement('img'); im.src = HEROES[k].img; im.alt = ''; im.loading = 'lazy';
        var sp = document.createElement('span'); sp.textContent = HEROES[k].name;
        b.appendChild(im); b.appendChild(sp);
        b.addEventListener('click', function () { applyHero(k, true); });
        box.appendChild(b);
      });
    });
  }

  /* ===== ABERTURA (tela 1 e 2) ===== */
  var introDone = false, introTimers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); introTimers.push(t); return t; }
  function clearIntro() { introTimers.forEach(clearTimeout); introTimers = []; }
  var CAPS = [[0, 'Atenção, heróis!'], [0.095, 'Uma missão muito especial acaba de chegar.'], [0.27, 'Nosso pequeno Théo está completando quatro anos e precisa reunir os maiores heróis do universo.'], [0.605, 'No dia 13 de dezembro, às três da tarde, você está convocado para uma aventura inesquecível.'], [0.93, 'Prepare seus poderes!']];
  var NARR_TEXT = 'Atenção, heróis! Uma missão muito especial acaba de chegar. Nosso pequeno Théo está completando quatro anos e precisa reunir os maiores heróis do universo. No dia 13 de dezembro, às três da tarde, você está convocado para uma aventura inesquecível. Prepare seus poderes!';
  function buildSideWebs() {
    var svg = $('sideWebs'), paths = [
      'M0 20 Q35 30 52 48', 'M0 45 Q30 48 52 52', 'M0 70 Q35 62 50 54', 'M0 92 Q35 74 49 56',
      'M100 18 Q65 30 48 48', 'M100 44 Q70 48 48 52', 'M100 72 Q65 62 50 54', 'M100 95 Q65 76 51 56'
    ];
    paths.forEach(function (d, i) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.style.animationDelay = (i * 0.08) + 's'; svg.appendChild(p);
    });
  }
  function startNarration(onEnd) {
    var n = $('narr'), done = false, dur = 21;
    function finish() { if (done) return; done = true; Audio.duck(false); onEnd(); }
    function runCaps(D) { CAPS.forEach(function (c) { later(function () { $('caption').textContent = c[1]; }, c[0] * D * 1000); }); }
    var played = false;
    if (Audio.isOn() && n) {
      n.muted = false; n.currentTime = 0;
      var pr = n.play();
      if (pr && pr.then) pr.then(function () { played = true; Audio.duck(true); runCaps((n.duration && isFinite(n.duration)) ? n.duration : 20.4); n.onended = function () { later(finish, 600); }; later(finish, 30000); })
        .catch(function () { fallback(); });
      else { played = true; }
    } else { fallback(); }
    function fallback() {
      if (done || played) return;
      runCaps(dur);
      if (Audio.isOn() && 'speechSynthesis' in window) {
        try { var u = new SpeechSynthesisUtterance(NARR_TEXT); u.lang = 'pt-BR'; u.rate = 1.02; u.pitch = 0.7; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
      }
      later(finish, dur * 1000);
    }
  }
  var h3d = null;
  function start3D() {
    if (true || !window.Theo3D || reduce) return false; /* 3D rejeitada pela usuária, desligada */
    var cv = document.createElement('canvas'); cv.id = 'city3d'; cv.setAttribute('aria-hidden', 'true'); $('intro').insertBefore(cv, $('intro').firstChild);
    var t0 = performance.now(), n = $('narr');
    var h = null;
    try { h = Theo3D.start(cv, function (ms) { var d = (n.duration && isFinite(n.duration)) ? n.duration : 18.4; var t = (n && !n.paused && n.currentTime > 0.05) ? n.currentTime * 1000 : ms; return t / (d * 1000); }); } catch (e) { h = null; }
    if (!h) { cv.remove(); return false; }
    h3d = { h: h, cv: cv }; $('intro').classList.add('is3d'); return true;
  }
  function stop3D() { if (!h3d) return; try { h3d.h.stop(); } catch (e) {} h3d.cv.remove(); h3d = null; $('intro').classList.remove('is3d'); }
  window.addEventListener('load', function () { var tries = 0; (function w() { if (window.Theo3D) { try { Theo3D.load(function () {}); } catch (e) {} } else if (tries++ < 40) setTimeout(w, 500); })(); });
  var cenaActive = false;
  function startCena() {
    var v = $('cena'); if (!v || reduce) return false;
    cenaActive = true; $('intro').classList.add('hascena'); try { v.currentTime = 0; } catch (e) {}
    var p = v.play(); if (p && p.catch) p.catch(function () { cenaActive = false; $('intro').classList.remove('hascena'); });
    return true;
  }
  function stopCena() { var v = $('cena'); cenaActive = false; if (v) { try { v.pause(); } catch (e) {} } $('intro').classList.remove('hascena'); }
  function waitCena(cb) {
    var v = $('cena'), once = false; function go() { if (once) return; once = true; cb(); }
    if (!cenaActive || !v || v.ended) return go();
    v.onended = go; var rem = (isFinite(v.duration) ? (v.duration - v.currentTime) : 40) * 1000 + 2500; later(go, rem);
  }
  function runIntro() {
    Audio.start(); Audio.setOn(true); setSoundUI(true);
    $('soundBtn').hidden = false; $('skipBtn').hidden = false;
    $('introStart').classList.add('out');
    var webs = $('sideWebs'); buildSideWebs();
    webs.querySelectorAll('path').forEach(function (p) { p.classList.add('draw'); });
    Audio.sfx('web');
    var cenaOn = startCena(); if (!cenaOn && !reduce) later(function () { $('swing').classList.add('go'); Audio.sfx('whoosh'); }, 700);
    startNarration(function () { waitCena(function () { if (!introDone) webBurstTransition(); }); });
  }
  function webBurstTransition() {
    stopCena(); $('caption').textContent = ''; $('swing').classList.remove('go'); $('swing').style.display = 'none';
    var b = $('webBurst');
    var svg = webSVG('big'); svg.removeAttribute('class'); svg.querySelectorAll('path').forEach(function (p) { p.style.strokeDasharray = 'none'; p.style.strokeDashoffset = '0'; p.style.fill = 'none'; p.style.stroke = '#fff'; p.style.strokeWidth = '1.6'; });
    svg.setAttribute('aria-hidden', 'true'); b.appendChild(svg); b.classList.add('go'); Audio.sfx('web');
    later(function () { b.classList.add('fill'); }, reduce ? 0 : 750);
    later(function () { showStage('heroPick'); b.classList.remove('go', 'fill'); b.innerHTML = ''; }, reduce ? 100 : 1200);
  }
  function showStage(id) {
    ['heroPick', 'game'].forEach(function (s) { $(s).hidden = s !== id; });
    $('skipBtn').hidden = false;
    var f = $(id).querySelector('button'); if (f) f.focus({ preventScroll: true });
    if (id === 'game') startGame();
  }
  function stopNarration() {
    clearIntro(); var n = $('narr'); try { n.pause(); } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {}
    Audio.duck(false); $('caption').textContent = '';
  }
  function goMain() {
    if (introDone) return; introDone = true; stopNarration(); stopCena();
    $('skipBtn').hidden = true; $('heroPick').hidden = true; $('game').hidden = true;
    $('soundBtn').hidden = false;
    $('main').hidden = false; $('main').classList.add('show'); try { var bv = $('bgvid'); bv.currentTime = 0; var pp = bv.play(); if (pp && pp.catch) pp.catch(function () {}); } catch (e) {}
    var intro = $('intro'); intro.style.transition = 'opacity .7s'; intro.style.opacity = '0'; intro.style.pointerEvents = 'none';
    setTimeout(function () { intro.classList.add('gone'); }, 750);
    window.scrollTo(0, 0);
    startMain();
  }

  /* ===== MINIJOGO (tela 4): 3 alvos ===== */
  var hits = 0, targetEl = null, moveT = 0;
  function startGame() {
    hits = 0; $('gameCount').textContent = '0 / 3'; $('gameWin').hidden = true; $('arena').hidden = false; spawnTarget();
  }
  function spawnTarget() {
    var ar = $('arena'); if (targetEl) targetEl.remove();
    var t = document.createElement('button'); t.type = 'button'; t.className = 'target'; t.setAttribute('aria-label', 'Alvo. Toque para lançar a teia.');
    var W = ar.clientWidth, H = ar.clientHeight, S = 88;
    t.style.left = Math.round(10 + Math.random() * Math.max(10, W - S - 20)) + 'px';
    t.style.top = Math.round(10 + Math.random() * Math.max(10, H - S - 20)) + 'px';
    t.addEventListener('click', function (e) { e.stopPropagation(); hitTarget(t); });
    ar.appendChild(t); targetEl = t;
    clearTimeout(moveT); moveT = setTimeout(spawnTarget, 3200);
  }
  function arenaWeb(x, y) {
    var s = webSVG(); s.style.left = x + 'px'; s.style.top = y + 'px'; $('arena').appendChild(s); setTimeout(function () { s.remove(); }, 1800); Audio.sfx('web');
  }
  function hitTarget(t) {
    var r = t.getBoundingClientRect(), ar = $('arena').getBoundingClientRect();
    arenaWeb(r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2);
    burst(r.left + r.width / 2, r.top + r.height / 2, 24, 6);
    hits++; $('gameCount').textContent = hits + ' / 3'; Audio.sfx('pop');
    t.classList.add('hit'); clearTimeout(moveT);
    if (hits >= 3) { setTimeout(function () { if (targetEl) targetEl.remove(); $('arena').hidden = true; $('gameWin').hidden = false; confettiRain(80); Audio.sfx('win'); $('gameGo').focus({ preventScroll: true }); }, 450); }
    else setTimeout(spawnTarget, 450);
  }

  /* ===== REVELAÇÃO ===== */
  function startMain() {
    var call = $('call'); call.classList.add('in');
    setTimeout(function () { $('hero').classList.add('revealed'); Audio.sfx('win'); burst(innerWidth / 2, innerHeight * 0.45, 40, 7); confettiRain(40); }, reduce ? 0 : 1500);
    setupReveal(); startCountdown(); setupParallax();
  }
  function setupReveal() {
    var els = [].slice.call(document.querySelectorAll('.reveal'));
    function check() {
      var h = window.innerHeight || document.documentElement.clientHeight;
      els = els.filter(function (e) { var r = e.getBoundingClientRect(); if (r.top < h * 0.95 && r.bottom > 0) { e.classList.add('in'); return false; } return true; });
      if (!els.length) { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); }
    }
    window.addEventListener('scroll', check, { passive: true }); window.addEventListener('resize', check);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.01 });
      els.forEach(function (e) { io.observe(e); });
    }
    setInterval(check, 700); check();
  }
  function setupParallax() {
    if (reduce) return;
    var imgs = document.querySelectorAll('.h'), stage = $('stage');
    var tx = 0, ty = 0, cxp = 0, cyp = 0, running = false;
    function apply() {
      cxp += (tx - cxp) * 0.1; cyp += (ty - cyp) * 0.1;
      imgs.forEach(function (im) { var d = parseFloat(im.dataset.depth) || 0.5; im.style.translate = (cxp * d * 14).toFixed(1) + 'px ' + (cyp * d * 8).toFixed(1) + 'px'; });
      if (Math.abs(tx - cxp) > 0.01 || Math.abs(ty - cyp) > 0.01) requestAnimationFrame(apply); else running = false;
    }
    function go() { if (!running) { running = true; requestAnimationFrame(apply); } }
    addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; go(); }, { passive: true });
    addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60)); ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90)); go(); }, { passive: true });
    addEventListener('scroll', function () { stage.style.translate = '0 ' + (scrollY * 0.12).toFixed(1) + 'px'; }, { passive: true });
  }

  /* ===== CONTAGEM REGRESSIVA ===== */
  function startCountdown() {
    var target = new Date(CONFIG.eventISO).getTime();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function upd() {
      var diff = target - Date.now();
      if (diff <= 0) { $('cd-d').textContent = '00'; $('cd-h').textContent = '00'; $('cd-m').textContent = '00'; $('cd-s').textContent = '00'; document.querySelector('.count-title').textContent = 'A FESTA COMEÇOU!'; return; }
      var s = Math.floor(diff / 1000);
      $('cd-d').textContent = pad(Math.floor(s / 86400));
      $('cd-h').textContent = pad(Math.floor(s % 86400 / 3600));
      $('cd-m').textContent = pad(Math.floor(s % 3600 / 60));
      $('cd-s').textContent = pad(s % 60);
    }
    upd(); setInterval(upd, 1000);
  }
  window.__countdownTarget = CONFIG.eventISO;

  /* ===== INTERAÇÕES ===== */
  function openModal(el) { el.hidden = false; el._prev = document.activeElement; var f = el.querySelector('button,input'); if (f) f.focus(); }
  function closeModal(el) { el.hidden = true; if (el._prev && el._prev.focus) el._prev.focus(); }

  function setSoundUI(on) { var b = $('soundBtn'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Desligar som' : 'Ligar som'); }
  $('soundBtn').addEventListener('click', function () {
    var n = $('narr');
    if (!Audio.isPlaying()) { Audio.start(); Audio.setOn(true); setSoundUI(true); return; }
    var on = Audio.toggle(); setSoundUI(on);
    try { n.muted = !on; if (!on) speechSynthesis.cancel(); } catch (e) {}
  });

  $('startBtn').addEventListener('click', runIntro);
  $('skipStart').addEventListener('click', function () { Audio.setOn(false); setSoundUI(false); goMain(); });
  $('skipBtn').addEventListener('click', goMain);
  $('pickGo').addEventListener('click', function () { showStage('game'); });
  $('gameGo').addEventListener('click', goMain);
  $('arena').addEventListener('click', function (e) { var r = this.getBoundingClientRect(); arenaWeb(e.clientX - r.left, e.clientY - r.top); });

  $('four').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 80, 9); confettiRain(80); Audio.sfx('win');
    var m = $('surprise'); openModal(m);
  });
  $('sClose').addEventListener('click', function () { closeModal($('surprise')); });
  $('surprise').addEventListener('click', function (e) { if (e.target === this) closeModal(this); });

  document.querySelectorAll('.gift').forEach(function (g) {
    g.addEventListener('click', function () {
      var on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', on);
      var r = g.getBoundingClientRect(); if (on) { burst(r.left + r.width / 2, r.top + 30, 18, 5); Audio.sfx('pop'); }
    });
  });

  $('coolerBtn').addEventListener('click', function () {
    var open = this.classList.toggle('open');
    var r = this.getBoundingClientRect(); if (open) { burst(r.left + r.width / 2, r.top + r.height * 0.3, 40, 6); Audio.sfx('pop'); }
  });
  (function () { // abre sozinho ao aparecer na tela
    if (!('IntersectionObserver' in window)) return;
    var c = $('coolerBtn'), io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { setTimeout(function () { c.classList.add('open'); }, 500); io.disconnect(); } }); }, { threshold: 0.6 });
    io.observe(c);
  })();

  var webOn = false;
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!$('surprise').hidden) closeModal($('surprise')); if (!$('rsvp').hidden) closeModal($('rsvp')); if (!$('done').hidden) closeModal($('done')); }
  });

  // Como chegar (usa só o endereço informado)
  $('mapBtn').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CONFIG.place);

  // Confirmar presença
  $('rsvpBtn').addEventListener('click', function () {
    $('rNote').textContent = wa ? 'Abre o WhatsApp da família com a mensagem pronta.' : 'O número de WhatsApp para confirmações ainda não foi configurado.';
    $('guest').value = userName || $('guest').value; openModal($('rsvp'));
  });
  $('rClose').addEventListener('click', function () { closeModal($('rsvp')); });
  $('rsvp').addEventListener('click', function (e) { if (e.target === this) closeModal(this); });
  function sendRsvp() {
    if (!$('guest').value.trim()) { toast('Digite seu nome para continuar.'); $('guest').focus(); return; }
    if (!wa) { toast('Número de WhatsApp não configurado.'); return; }
    var name = $('guest').value.trim(), qty = parseInt($('qty').value, 10) || 1;
    var msg = CONFIG.guestMsg + '\nNome: ' + name + '\nPessoas: ' + qty + '\nHerói: ' + HEROES[heroKey].name;
    var url = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank', 'noopener');
    userName = name; nameInp.value = name; try { localStorage.setItem('theo4.name', name); } catch (e) {}
    closeModal($('rsvp')); openDone();
  }
  $('rSend').addEventListener('click', sendRsvp);
  $('rsvpForm').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); sendRsvp(); } });
  $('imgClose').addEventListener('click', function () { closeModal($('imgView')); });

  /* ===== CARTEIRINHA ===== */
  var imgCache = {};
  function loadImg(src, cb) { if (imgCache[src]) return cb(imgCache[src]); var i = new Image(); i.onload = function () { imgCache[src] = i; cb(i); }; i.src = src; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawBadge(cv) {
    if (!cv) return;
    var H = HEROES[heroKey], c = cv.getContext('2d'), W = cv.width, Ht = cv.height, v = H.vars;
    var g = c.createLinearGradient(0, 0, 0, Ht); g.addColorStop(0, '#0a1a3a'); g.addColorStop(1, '#030812');
    c.clearRect(0, 0, W, Ht); rr(c, 0, 0, W, Ht, 44); c.fillStyle = g; c.fill();
    c.lineWidth = 4; c.shadowColor = '#35e6ff'; c.shadowBlur = 18; c.strokeStyle = '#35e6ff'; rr(c, 10, 10, W - 20, Ht - 20, 36); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(53,230,255,.14)'; rr(c, 40, 40, W - 80, 96, 16); c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(53,230,255,.7)'; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 36px Orbitron, sans-serif'; c.fillText('AGENTE CONVOCADO', W / 2, 100);
    c.fillStyle = '#ff6cc4'; c.font = '700 30px Orbitron, sans-serif'; c.fillText('MISSÃO THÉO 4 ANOS', W / 2, 182);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(W / 2, 400, 170, 0, 7); c.fill();
    c.lineWidth = 4; c.strokeStyle = '#35e6ff'; c.shadowColor = '#35e6ff'; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
    var name = (userName || 'SUPER-HERÓI').toUpperCase();
    loadImg((window.__HD && window.__HD[heroKey]) || H.img, function (im) {
      var ar = im.width / im.height, hh = 330, ww = hh * ar; if (ww > 300) { ww = 300; hh = ww / ar; }
      c.drawImage(im, W / 2 - ww / 2, 400 - hh / 2 - 6, ww, hh);
      c.fillStyle = '#fff'; var fs = 58; c.font = '900 ' + fs + 'px Orbitron, sans-serif';
      while (c.measureText(name).width > W - 90 && fs > 26) { fs -= 4; c.font = '900 ' + fs + 'px Orbitron, sans-serif'; }
      c.fillText(name, W / 2, 640);
      c.fillStyle = '#35e6ff'; c.font = '700 36px Rajdhani, sans-serif'; c.fillText('Herói: ' + H.name, W / 2, 692);
      c.fillStyle = '#fff'; c.font = '700 32px Orbitron, sans-serif'; c.fillText('13/12 • 15h', W / 2, 760);
      c.font = '600 28px Rajdhani, sans-serif'; c.fillText('Salão Espaço Magnata', W / 2, 800);
      c.fillText('Rua E, nº 5 - Cosmos', W / 2, 836);
    });
  }
  if (document.fonts && document.fonts.load) { Promise.all([document.fonts.load('900 40px Orbitron'), document.fonts.load('700 30px Orbitron'), document.fonts.load('600 28px Rajdhani'), document.fonts.load('700 30px Rajdhani')]).then(function () { try { drawBadge($('badgeCv')); } catch (e) {} }); }
  function badgeBlob(cb) { var cv = document.createElement('canvas'); cv.width = 640; cv.height = 880; drawBadge(cv); setTimeout(function () { cv.toBlob(cb, 'image/png'); }, 120); }
  var nameInp = $('badgeName'); nameInp.value = userName;
  nameInp.addEventListener('input', function () { userName = nameInp.value.trim(); try { localStorage.setItem('theo4.name', userName); } catch (e) {} drawBadge($('badgeCv')); });
  $('badgeSave').addEventListener('click', function () {
    var cv = document.createElement('canvas'); cv.width = 640; cv.height = 880; drawBadge(cv);
    setTimeout(function () { try { $('imgViewImg').src = cv.toDataURL('image/png'); } catch (e) {} openModal($('imgView')); }, 150);
  });
  $('badgeShare').addEventListener('click', function () {
    badgeBlob(function (b) {
      var f = new File([b], 'carteirinha-theo-4-anos.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'Missão Théo 4 anos', text: 'Fui convocado para a missão do aniversário de 4 anos do Théo!' }).catch(function () {});
      else if (navigator.share) navigator.share({ title: 'Missão Théo 4 anos', text: 'Fui convocado para a missão do aniversário de 4 anos do Théo! ' + (CONFIG.siteUrl || location.href) }).catch(function () {});
      else { $('badgeSave').click(); }
    });
  });

  /* ===== TELA 8: missão concluída + bolo ===== */
  $('cake').addEventListener('click', function () {
    var on = this.classList.toggle('blown'); var r = this.getBoundingClientRect();
    if (on) { burst(r.left + r.width / 2, r.top + 20, 70, 8); confettiRain(70); Audio.sfx('win'); }
  });
  $('dClose').addEventListener('click', function () { closeModal($('done')); });
  $('done').addEventListener('click', function (e) { if (e.target === this) closeModal(this); });
  $('doneSave').addEventListener('click', function () { $('badgeSave').click(); });
  function openDone() {
    $('dNote').textContent = 'Seu WhatsApp foi aberto com a mensagem pronta. Toque em enviar por lá para confirmar sua presença.';
    $('cake').classList.remove('blown'); drawBadge($('doneCv')); openModal($('done'));
    confettiRain(80); Audio.sfx('win');
  }

  // Teia ao tocar no hero (microinteração)
  document.addEventListener('pointerdown', function (e) {
    if (!$('main').hidden && !webOn && e.target.closest && e.target.closest('.h')) { burst(e.clientX, e.clientY, 14, 5); Audio.sfx('pop'); }
  });

  /* init */
  initCanvas(); buildPickers(); applyHero(heroKey, false);
})();
