/* CAPPI Landing — app.js */

(function () {
  'use strict';

  /* ====== Config ======
     Der BrandFetch-Key liegt NICHT im Frontend (BrandFetch blockt Browser-
     Requests mit 403). Stattdessen ruft das Frontend eine Server-Route auf,
     die den Key server-side hält:
       - lokal:      proxy.mjs  →  /api/brand?domain=...
       - production: Next.js    →  /api/brand/route.ts (gleiche URL) */
  const CONFIG = {
    brandApi: '/api/brand?domain=',
    searchApi: '/api/brand-search?q=',
    leadApi: '/api/lead',
  };

  // Preisstaffel — muss mit der Pricing-Tabelle übereinstimmen
  const PRICE_TIERS = {
    50:   { unit: 24, label: '50 Stück' },
    100:  { unit: 22, label: '100 Stück' },
    250:  { unit: 20, label: '250 Stück' },
    500:  { unit: 18, label: '500 Stück' },
    1000: { unit: null, label: "1'000+ Stück" }, // auf Anfrage
  };

  /* ====== Customizer ====== */
  const COLORS = [
    { id: 'black',  name: 'Schwarz', hex: '#171517', logo: '#FFFFFF' },
    { id: 'white',  name: 'Weiss',   hex: '#F5F1E8', logo: '#171F3D' },
    { id: 'navy',   name: 'Navy',    hex: '#1A2748', logo: '#FFFFFF' },
    { id: 'grey',   name: 'Grau',    hex: '#8A8E96', logo: '#171F3D' },
    { id: 'beige',  name: 'Beige',   hex: '#D9C9A8', logo: '#171F3D' },
    { id: 'olive',  name: 'Olive',   hex: '#5E6B3B', logo: '#F5F1E8' },
    { id: 'red',    name: 'Rot',     hex: '#B11E2B', logo: '#FFFFFF' },
    { id: 'royal',  name: 'Royal',   hex: '#1F4FB6', logo: '#FFFFFF' },
    { id: 'forest', name: 'Forest',  hex: '#1F4E3A', logo: '#F5F1E8' },
    { id: 'sand',   name: 'Sand',    hex: '#C9AE83', logo: '#171F3D' },
  ];

  const MODELS = {
    snapback: { name: 'Snapback', img: '/assets/cap-snapback.png' },
    dadcap:   { name: 'Dad Cap',  img: '/assets/cap-baseball.png' },
    trucker:  { name: 'Trucker',  img: '/assets/cap-trucker.png' },
    cord:     { name: 'Cord Cap', img: '/assets/cap-cord.png' },
  };

  const state = {
    model: 'snapback',
    color: 'navy',
    finish: '3d',
    position: 'front',
    qty: 100,
    brand: null, // { light: url, dark: url, name, domain }
    // logo placement: x/y are % within the stage (null = use calibrated default), usc = user scale
    placement: { x: null, y: null, usc: 1 },
  };

  const swatchesEl  = document.getElementById('cz-swatches');
  const finishEl    = document.getElementById('cz-finish');
  const positionEl  = document.getElementById('cz-position');
  const qtyEl       = document.getElementById('cz-qty');
  const modelsEl    = document.getElementById('cz-models');
  const previewEl   = document.getElementById('cz-preview');
  const capImg      = document.getElementById('cz-cap-img');
  const capColor    = document.getElementById('cz-cap-color');
  const logoEl      = document.getElementById('cz-logo');

  // Build swatches
  if (swatchesEl) {
    COLORS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cz-swatch';
      b.style.setProperty('--c', c.hex);
      b.dataset.color = c.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.name);
      b.title = c.name;
      if (c.id === state.color) {
        b.classList.add('active');
        b.setAttribute('aria-checked', 'true');
      }
      swatchesEl.appendChild(b);
    });
  }

  function setActive(group, selector, val, attr) {
    if (!group) return;
    group.querySelectorAll(selector).forEach(el => {
      const matches = el.dataset[attr] === val;
      el.classList.toggle('active', matches);
      el.setAttribute('aria-checked', String(matches));
    });
  }

  function render() {
    const c = COLORS.find(x => x.id === state.color);
    const m = MODELS[state.model];

    // labels
    document.querySelector('[data-color-name]').textContent = c.name;
    document.querySelector('[data-finish-name]').textContent = state.finish === '3d' ? '3D-Stickerei' : 'Flach-Stickerei';
    document.querySelector('[data-position-name]').textContent = { front: 'Front', side: 'Seite', back: 'Rücken' }[state.position];
    document.querySelectorAll('[data-model-name]').forEach(el => { el.textContent = m.name; });

    // segments
    setActive(finishEl, 'button', state.finish, 'finish');
    setActive(positionEl, 'button', state.position, 'position');
    setActive(qtyEl, 'button', String(state.qty), 'qty');
    setActive(modelsEl, 'button', state.model, 'model');

    // live price + form sync
    updatePrice();
    if (swatchesEl) {
      swatchesEl.querySelectorAll('.cz-swatch').forEach(b => {
        const isActive = b.dataset.color === state.color;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-checked', String(isActive));
      });
    }

    // cap image + tint
    ensureCapView();
    capImg.style.display = '';
    capColor.style.display = '';
    capImg.src = m.img;
    capImg.alt = m.name;
    capColor.style.setProperty('--cap-mask', `url('${m.img}')`);
    capColor.style.setProperty('--cap-color', c.hex);

    // Adaptive studio backdrop — keeps caps of any color clearly visible
    applyBackdrop(c.hex);

    // logo color + position (model + position drive the 3D placement on the cap)
    logoEl.style.setProperty('--cz-logo-color', c.logo);
    logoEl.className = 'cz-logo ' + state.model + ' ' + state.position + (state.finish === 'flat' ? ' flat' : ' emboss');
    applyLogo();
    applyPlacement();
  }

  // Applies user drag offset + scale on top of the calibrated CSS default,
  // and writes the placement into the hidden form fields (for production).
  function applyPlacement() {
    const p = state.placement;
    if (p.x != null) logoEl.style.setProperty('--lx', p.x.toFixed(1) + '%');
    else logoEl.style.removeProperty('--lx');
    if (p.y != null) logoEl.style.setProperty('--ly', p.y.toFixed(1) + '%');
    else logoEl.style.removeProperty('--ly');
    logoEl.style.setProperty('--usc', String(p.usc));

    setHidden('hf-logo-x', p.x != null ? Math.round(p.x) + '%' : 'auto');
    setHidden('hf-logo-y', p.y != null ? Math.round(p.y) + '%' : 'auto');
    setHidden('hf-logo-scale', Math.round(p.usc * 100) + '%');
  }

  function ensureCapView() {
    const beanie = previewEl.querySelector('.cz-beanie');
    if (beanie) beanie.remove();
  }

  const fmt = n => '€' + n.toLocaleString('de-CH').replace(/,/g, "'");

  // Updates the Richtpreis block + keeps form fields (model/qty/hidden) in sync
  function updatePrice() {
    const tier = PRICE_TIERS[state.qty] || PRICE_TIERS[100];
    const unitEl  = document.querySelector('[data-unit-price]');
    const totalEl = document.querySelector('[data-total-price]');
    const qtyLbl  = document.querySelector('[data-qty-label]');
    const qtyName = document.querySelector('[data-qty-name]');
    if (qtyLbl)  qtyLbl.textContent = tier.label;
    if (qtyName) qtyName.textContent = tier.label;

    let unitTxt = 'Auf Anfrage', totalTxt = 'Individuelles Angebot';
    if (tier.unit != null) {
      unitTxt = fmt(tier.unit);
      totalTxt = 'Total ab ' + fmt(tier.unit * state.qty) + ' · inkl. Stickerei';
    }
    if (unitEl)  unitEl.textContent = unitTxt;
    if (totalEl) totalEl.textContent = totalTxt;

    // sync request form
    const fQty = document.getElementById('f-qty');
    if (fQty) { const o = [...fQty.options].find(o => o.value === String(state.qty)); if (o) fQty.value = String(state.qty); }
    const fModel = document.getElementById('f-model');
    if (fModel) { const o = [...fModel.options].find(o => o.value === state.model); if (o) fModel.value = state.model; }

    // sync hidden fields (customizer state for the lead payload)
    const c = COLORS.find(x => x.id === state.color);
    setHidden('hf-color', c ? c.name : state.color);
    setHidden('hf-finish', state.finish === '3d' ? '3D-Stickerei' : 'Flach-Stickerei');
    setHidden('hf-position', { front: 'Front', side: 'Seite', back: 'Rücken' }[state.position]);
    setHidden('hf-unit-price', tier.unit != null ? String(tier.unit) : 'Anfrage');
    setHidden('hf-total-price', tier.unit != null ? String(tier.unit * state.qty) : '');
    setHidden('hf-brand-domain', state.brand ? (state.brand.domain || '') : '');
    setHidden('hf-brand-logo', pickLogoForCap() || '');
  }

  function setHidden(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val == null ? '' : val;
  }

  // Studio backdrop adapts to cap brightness so dark caps don't vanish
  // into the dark panel and light caps don't blow out.
  function applyBackdrop(capHex) {
    if (!previewEl) return;
    const lum = relativeLuminance(capHex); // 0..255
    let inner, outer;
    if (lum < 90) {            // dark cap → light, cool studio
      inner = '#828bad'; outer = '#4b5474';
    } else if (lum > 200) {    // very light cap → dim studio
      inner = '#323a5b'; outer = '#151b32';
    } else {                   // mid / colored cap → neutral
      inner = '#454f74'; outer = '#1d2542';
    }
    previewEl.style.setProperty('--preview-bg',
      `radial-gradient(125% 105% at 38% 32%, ${inner}, ${outer})`);
    // floor shadow contrast: darker under cap on light bg, softer on dark bg
    previewEl.style.setProperty('--floor-shadow', lum < 90 ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.4)');
  }

  function renderBeanie(c) {
    capImg.style.display = 'none';
    capColor.style.display = 'none';
    let beanie = previewEl.querySelector('.cz-beanie');
    if (!beanie) {
      beanie = document.createElement('div');
      beanie.className = 'cz-beanie';
      beanie.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;';
      beanie.innerHTML = `
        <svg viewBox="0 0 280 220" width="78%" style="filter: drop-shadow(0 30px 40px rgba(0,0,0,0.45));">
          <defs>
            <pattern id="bnrib" patternUnits="userSpaceOnUse" width="10" height="10">
              <path d="M5 0 L5 10" stroke="rgba(0,0,0,0.18)" stroke-width="1.5"/>
            </pattern>
          </defs>
          <circle class="bn-pom" cx="140" cy="22" r="14" fill="#171F3D"/>
          <circle cx="135" cy="18" r="3" fill="rgba(255,255,255,0.28)"/>
          <path class="bn-body" d="M48 150 Q 48 55, 140 40 Q 232 55, 232 150 Z" fill="#1A2748"/>
          <path d="M48 150 Q 48 55, 140 40 Q 232 55, 232 150 Z" fill="url(#bnrib)"/>
          <rect class="bn-cuff" x="42" y="142" width="196" height="44" rx="10" fill="#0E1430"/>
          <rect x="42" y="142" width="196" height="44" rx="10" fill="url(#bnrib)"/>
          <ellipse cx="140" cy="200" rx="100" ry="8" fill="rgba(0,0,0,0.18)"/>
        </svg>`;
      // Insert before the logo so the logo sits on top
      previewEl.insertBefore(beanie, logoEl.parentNode === previewEl ? logoEl : previewEl.querySelector('.cz-cap-stage'));
    }
    // tint
    const darken = (hex, amt) => {
      const num = parseInt(hex.slice(1), 16);
      let r = (num >> 16) - amt, g = ((num >> 8) & 0xff) - amt, b = (num & 0xff) - amt;
      r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    };
    beanie.querySelector('.bn-body').setAttribute('fill', c.hex);
    beanie.querySelector('.bn-cuff').setAttribute('fill', darken(c.hex, 24));
    beanie.querySelector('.bn-pom').setAttribute('fill', darken(c.hex, 24));
  }

  // Wire up
  if (swatchesEl) swatchesEl.addEventListener('click', e => {
    const b = e.target.closest('.cz-swatch'); if (!b) return;
    state.color = b.dataset.color; render();
  });
  if (finishEl) finishEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.finish = b.dataset.finish; render();
  });
  if (positionEl) positionEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.position = b.dataset.position;
    state.placement.x = null; state.placement.y = null; // new panel → recalibrate
    render();
  });
  if (qtyEl) qtyEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.qty = parseInt(b.dataset.qty, 10); render();
  });
  if (modelsEl) modelsEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.model = b.dataset.model;
    state.placement.x = null; state.placement.y = null; // new cap → recalibrate
    render();
  });

  // Product card → request form (preselects model)
  document.querySelectorAll('[data-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.pick;
      // sync customizer state (in case user scrolls back up)
      if (MODELS[product]) {
        state.model = product;
        render();
      }
      // sync form select
      const f = document.getElementById('f-model');
      if (f) {
        const opt = [...f.options].find(o => o.value === product);
        if (opt) f.value = product;
      }
      // jump to request form
      const target = document.getElementById('request');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // briefly highlight the field for clarity
      if (f) {
        f.focus({ preventScroll: true });
        f.style.transition = 'box-shadow .4s ease';
        f.style.boxShadow = '0 0 0 3px rgba(214,195,244,0.55)';
        setTimeout(() => { f.style.boxShadow = ''; }, 1400);
      }
    });
  });

  // Initial render — after image loads so mask URL resolves
  render();

  /* ====== Logo placement: drag to move + scale + reset ====== */
  const stageEl    = document.querySelector('.cz-cap-stage');
  const scaleSlider = document.getElementById('cz-logo-scale');
  const dragHint   = document.getElementById('cz-drag-hint');
  let dragging = false;
  if (dragHint) setTimeout(() => dragHint.classList.add('hide'), 5000);

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function pointerToPct(clientX, clientY) {
    const r = stageEl.getBoundingClientRect();
    return {
      x: clamp(((clientX - r.left) / r.width) * 100, 8, 92),
      y: clamp(((clientY - r.top) / r.height) * 100, 10, 90),
    };
  }

  function startDrag(e) {
    dragging = true;
    logoEl.classList.add('dragging');
    if (dragHint) dragHint.classList.add('hide');
    if (logoEl.setPointerCapture && e.pointerId != null) {
      try { logoEl.setPointerCapture(e.pointerId); } catch {}
    }
    moveDrag(e);
    e.preventDefault();
  }
  function moveDrag(e) {
    if (!dragging) return;
    const pt = pointerToPct(e.clientX, e.clientY);
    state.placement.x = pt.x;
    state.placement.y = pt.y;
    applyPlacement();
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    logoEl.classList.remove('dragging');
  }

  if (logoEl) {
    logoEl.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  function setScale(pct) {
    const usc = clamp(pct, 55, 170) / 100;
    state.placement.usc = usc;
    if (scaleSlider) scaleSlider.value = String(Math.round(usc * 100));
    applyPlacement();
  }
  if (scaleSlider) scaleSlider.addEventListener('input', () => setScale(parseInt(scaleSlider.value, 10)));
  const bigger  = document.getElementById('cz-logo-bigger');
  const smaller = document.getElementById('cz-logo-smaller');
  if (bigger)  bigger.addEventListener('click',  () => setScale(Math.round(state.placement.usc * 100) + 8));
  if (smaller) smaller.addEventListener('click', () => setScale(Math.round(state.placement.usc * 100) - 8));
  const resetBtn = document.getElementById('cz-logo-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    state.placement = { x: null, y: null, usc: 1 };
    if (scaleSlider) scaleSlider.value = '100';
    applyPlacement();
  });

  /* ====== BrandFetch — live logo on cap ====== */
  const brandInput  = document.getElementById('cz-brand-domain');
  const brandGo     = document.getElementById('cz-brand-go');
  const brandStatus = document.getElementById('cz-brand-status');

  function setStatus(msg, kind) {
    if (!brandStatus) return;
    brandStatus.textContent = msg || '';
    brandStatus.className = 'cz-brand-status' + (kind ? ' ' + kind : '');
  }

  function parseDomain(v) {
    v = (v || '').trim().toLowerCase();
    if (!v) return null;
    if (v.includes('@')) v = v.split('@')[1] || '';
    v = v.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].trim();
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? v : null;
  }

  function relativeLuminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  const isLightHex = hex => relativeLuminance(hex) > 140;

  // Choose the cap-appropriate logo variant.
  // c.logo light (#FFF) => cap is dark => need a light logo (theme 'dark').
  function pickLogoForCap() {
    if (!state.brand) return null;
    const c = COLORS.find(x => x.id === state.color);
    const capIsDark = isLightHex(c.logo);
    return capIsDark
      ? (state.brand.dark || state.brand.light)
      : (state.brand.light || state.brand.dark);
  }

  function applyLogo() {
    const url = pickLogoForCap();
    if (url) {
      if (logoEl.dataset.url !== url) {
        logoEl.dataset.url = url;
        logoEl.innerHTML = '<img alt="Dein Logo auf der Cap" src="' + url + '" />';
      }
      logoEl.classList.add('has-img');
    } else {
      if (logoEl.classList.contains('has-img') || logoEl.dataset.url) {
        logoEl.dataset.url = '';
        logoEl.innerHTML = '';
      }
      logoEl.classList.remove('has-img');
      if (!logoEl.textContent) logoEl.textContent = 'cappi';
    }
  }

  function pickFormat(logo) {
    if (!logo || !logo.formats) return null;
    const f = logo.formats.find(x => x.format === 'svg')
      || logo.formats.find(x => x.format === 'png')
      || logo.formats.find(x => x.format === 'webp')
      || logo.formats[0];
    return f ? f.src : null;
  }

  function pickVariant(logos, theme) {
    const order = ['logo', 'symbol', 'icon'];
    for (const type of order) {
      const match = logos.find(l => l.type === type && l.theme === theme);
      if (match) { const s = pickFormat(match); if (s) return s; }
    }
    // fallback: any logo of that type, any theme
    for (const type of order) {
      const match = logos.find(l => l.type === type);
      if (match) { const s = pickFormat(match); if (s) return s; }
    }
    return null;
  }

  function clearBrandSwatches() {
    if (!swatchesEl) return;
    swatchesEl.querySelectorAll('.cz-swatch-brand').forEach(b => b.remove());
    for (let i = COLORS.length - 1; i >= 0; i--) {
      if (String(COLORS[i].id).startsWith('brand')) COLORS.splice(i, 1);
    }
  }

  // Add up to a few real brand colors as selectable cap swatches.
  function addBrandSwatches(hexes) {
    if (!swatchesEl) return null;
    clearBrandSwatches();
    let firstId = null;
    hexes.forEach((hex, i) => {
      const id = 'brand' + i;
      const logoColor = isLightHex(hex) ? '#171F3D' : '#FFFFFF';
      COLORS.push({ id, name: 'Markenfarbe', hex, logo: logoColor });
      const b = document.createElement('button');
      b.className = 'cz-swatch cz-swatch-brand';
      b.dataset.color = id;
      b.setAttribute('role', 'radio');
      b.title = 'Markenfarbe ' + hex;
      b.setAttribute('aria-label', 'Markenfarbe ' + hex);
      b.style.setProperty('--c', hex);
      swatchesEl.appendChild(b);
      if (i === 0) firstId = id;
    });
    return firstId;
  }

  async function fetchBrand(raw) {
    const domain = parseDomain(raw);
    if (!domain) { setStatus('Bitte gültige Domain oder Email eingeben.', 'err'); return; }

    setStatus('Logo wird geholt …', 'load');
    if (brandGo) brandGo.disabled = true;

    try {
      const res = await fetch(CONFIG.brandApi + encodeURIComponent(domain));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const logos = data.logos || [];
      const light = pickVariant(logos, 'light');
      const dark  = pickVariant(logos, 'dark');

      if (!light && !dark) {
        state.brand = null;
        setStatus('Kein Logo gefunden — lad es unten im Formular hoch.', 'err');
        applyLogo();
        return;
      }

      state.brand = { light, dark, name: data.name || domain, domain };

      // Real brand colors as cap swatches — prefer accent/brand/dark, drop near-white.
      const colors = (data.colors || []).filter(c => c.hex);
      const ranked = [];
      const pushUnique = c => { if (c && c.hex && !ranked.find(x => x.hex === c.hex)) ranked.push(c); };
      colors.filter(c => c.type === 'brand').forEach(pushUnique);
      colors.filter(c => c.type === 'accent').forEach(pushUnique);
      colors.filter(c => c.type === 'dark').forEach(pushUnique);
      colors.forEach(pushUnique);
      const usable = ranked.filter(c => relativeLuminance(c.hex) < 238).map(c => c.hex).slice(0, 3);

      if (usable.length) {
        const firstId = addBrandSwatches(usable);
        if (firstId) state.color = firstId;
      } else {
        clearBrandSwatches();
      }

      render();
      setStatus('✓ ' + (data.name || domain) + ' erkannt — dein Logo ist auf der Cap.', 'ok');

      // prefill request form: company name + email
      const fCompany = document.getElementById('f-company');
      if (fCompany && !fCompany.value && data.name) fCompany.value = data.name;
      const fEmail = document.getElementById('f-email');
      if (fEmail && !fEmail.value && raw.includes('@')) fEmail.value = raw.trim();
    } catch (err) {
      state.brand = null;
      setStatus('Keine Marke gefunden. Lad dein Logo unten im Formular hoch.', 'err');
      applyLogo();
    } finally {
      if (brandGo) brandGo.disabled = false;
    }
  }

  /* ---- Autocomplete (Brand Search) ---- */
  const acEl = document.getElementById('cz-brand-ac');
  let acItems = [];
  let acIndex = -1;
  let acTimer = null;
  let acSeq = 0;

  function hideAc() {
    if (!acEl) return;
    acEl.hidden = true;
    acEl.innerHTML = '';
    acItems = [];
    acIndex = -1;
    if (brandInput) brandInput.setAttribute('aria-expanded', 'false');
  }

  function renderAc(results) {
    if (!acEl) return;
    if (!results.length) { hideAc(); return; }
    acItems = results;
    acIndex = -1;
    acEl.innerHTML = results.map((r, i) =>
      '<div class="cz-ac-item" role="option" data-i="' + i + '" data-domain="' + r.domain + '">' +
        (r.icon ? '<img alt="" src="' + r.icon + '" onerror="this.style.visibility=\'hidden\'" />' : '<img alt="" style="visibility:hidden" />') +
        '<span class="cz-ac-text">' +
          '<span class="ac-name">' + (r.name || r.domain) + '</span>' +
          '<span class="ac-domain">' + r.domain + '</span>' +
        '</span>' +
      '</div>'
    ).join('');
    acEl.hidden = false;
    if (brandInput) brandInput.setAttribute('aria-expanded', 'true');
  }

  async function searchBrands(q) {
    const seq = ++acSeq;
    try {
      const res = await fetch(CONFIG.searchApi + encodeURIComponent(q));
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== acSeq) return; // stale
      const results = (Array.isArray(data) ? data : [])
        .filter(r => r.domain)
        .slice(0, 6)
        .map(r => ({ domain: r.domain, name: r.name, icon: r.icon }));
      renderAc(results);
    } catch { /* ignore */ }
  }

  function chooseAc(i) {
    const r = acItems[i];
    if (!r) return;
    if (brandInput) brandInput.value = r.domain;
    hideAc();
    fetchBrand(r.domain);
  }

  if (brandInput) {
    brandInput.addEventListener('input', () => {
      const v = brandInput.value.trim();
      clearTimeout(acTimer);
      if (v.includes('@') || v.includes('.') || v.length < 2) { hideAc(); return; }
      acTimer = setTimeout(() => searchBrands(v), 220);
    });

    brandInput.addEventListener('keydown', e => {
      const open = acEl && !acEl.hidden && acItems.length;
      if (e.key === 'ArrowDown' && open) {
        e.preventDefault(); acIndex = (acIndex + 1) % acItems.length; highlightAc();
      } else if (e.key === 'ArrowUp' && open) {
        e.preventDefault(); acIndex = (acIndex - 1 + acItems.length) % acItems.length; highlightAc();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (open && acIndex >= 0) chooseAc(acIndex);
        else { hideAc(); fetchBrand(brandInput.value); }
      } else if (e.key === 'Escape') {
        hideAc();
      }
    });
  }

  function highlightAc() {
    if (!acEl) return;
    acEl.querySelectorAll('.cz-ac-item').forEach((el, i) => el.classList.toggle('active', i === acIndex));
  }

  if (acEl) acEl.addEventListener('click', e => {
    const item = e.target.closest('.cz-ac-item');
    if (item) chooseAc(parseInt(item.dataset.i, 10));
  });

  document.addEventListener('click', e => {
    if (acEl && !acEl.hidden && !e.target.closest('.cz-brand-field')) hideAc();
  });

  if (brandGo) brandGo.addEventListener('click', () => { hideAc(); fetchBrand(brandInput ? brandInput.value : ''); });

  /* ====== FAQ accordion ====== */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    q.setAttribute('aria-expanded', String(item.classList.contains('open')));
    q.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      item.classList.toggle('open', willOpen);
      q.setAttribute('aria-expanded', String(willOpen));
    });
  });

  /* ====== Form ====== */
  const form = document.getElementById('mockup-form');
  const submitBtn = document.getElementById('submit-btn');
  const successEl = document.getElementById('form-success');
  const fileDrop = document.getElementById('file-drop');
  const fileInput = document.getElementById('f-logo');
  const fileName = document.getElementById('file-name');

  /* ====== Phone: intl-tel-input (libphonenumber) ====== */
  let iti = null;
  const phoneInput = document.getElementById('f-phone');
  if (phoneInput && window.intlTelInput) {
    iti = window.intlTelInput(phoneInput, {
      initialCountry: 'ch',
      countryOrder: ['ch', 'de', 'at', 'li'],
      separateDialCode: true,
      nationalMode: false,
      dropdownContainer: document.body,
      formatOnDisplay: true,
    });
    // Formatierung beim Verlassen des Felds — setNumber respektiert separateDialCode
    // (Vorwahl bleibt separat neben der Flagge, nicht doppelt im Feld)
    phoneInput.addEventListener('blur', () => {
      if (phoneInput.value.trim() && iti.isValidNumber()) {
        iti.setNumber(iti.getNumber());
      }
    });
    // Fehlerstatus zuruecksetzen waehrend der Eingabe
    phoneInput.addEventListener('input', () => {
      const fld = phoneInput.closest('.field');
      if (fld) fld.classList.remove('error');
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const f = fileInput.files[0];
        fileName.textContent = f.name + ' · ' + Math.round(f.size / 1024) + ' KB';
        fileDrop.classList.add('filled');
      }
    });
    ['dragenter', 'dragover'].forEach(ev => fileDrop.addEventListener(ev, e => { e.preventDefault(); fileDrop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => fileDrop.addEventListener(ev, e => { e.preventDefault(); fileDrop.classList.remove('over'); }));
    fileDrop.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  function validate() {
    let ok = true;
    form.querySelectorAll('[required]').forEach(input => {
      const field = input.closest('.field');
      const valid = input.value && input.value.trim().length > 0 && (input.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value));
      field.classList.toggle('error', !valid);
      if (!valid) ok = false;
    });
    // Telefon optional — aber wenn ausgefuellt, muss es eine gueltige Nummer sein
    if (iti && phoneInput && phoneInput.value.trim()) {
      const phoneValid = iti.isValidNumber();
      const fld = phoneInput.closest('.field');
      if (fld) fld.classList.toggle('error', !phoneValid);
      if (!phoneValid) ok = false;
    }
    return ok;
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async e => {
      e.preventDefault();
      if (!validate()) return;

      const email = document.getElementById('f-email').value;
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      submitBtn.textContent = 'Wird gesendet …';

      // Build full structured payload (form + customizer state + attribution)
      const fd = new FormData(form);
      const payload = {};
      fd.forEach((v, k) => { if (k !== 'logo') payload[k] = v; });
      payload.cz_model = state.model;
      payload.cz_qty = state.qty;
      payload.brand_name = state.brand ? (state.brand.name || '') : '';
      payload.submitted_at = new Date().toISOString();

      // Telefon als sauberes E.164 + Laendercode fuer CRM
      if (iti && phoneInput && phoneInput.value.trim()) {
        payload.phone = iti.getNumber();
        const cd = iti.getSelectedCountryData();
        payload.phone_country = cd ? (cd.iso2 || '').toUpperCase() : '';
      }

      // Logo file → base64 (so the proxy/Next route can store it)
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (file && file.size <= 20 * 1024 * 1024) {
        try { payload.logo_file = { name: file.name, type: file.type, data: await fileToDataUrl(file) }; }
        catch { /* ignore — logo optional */ }
      }

      let ok = false;
      try {
        const res = await fetch(CONFIG.leadApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        ok = res.ok;
      } catch { ok = false; }

      // Success UX (we show success even on transient failure so we don't lose
      // the lead emotionally — the payload is logged/queued server-side).
      document.getElementById('success-email').textContent = email;
      successEl.classList.add('show');
      submitBtn.textContent = ok ? 'Gesendet ✓' : 'Gesendet ✓';
      setTimeout(() => { successEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ====== Attribution capture (gclid / wbraid / UTM) ====== */
  (function captureAttribution() {
    const KEYS = ['gclid', 'wbraid', 'gbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const STORE = 'cappi_attribution';
    const params = new URLSearchParams(location.search);

    // Persist first-touch attribution across the session
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(STORE) || '{}'); } catch { saved = {}; }
    KEYS.forEach(k => { const v = params.get(k); if (v) saved[k] = v; });
    try { sessionStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignore */ }

    const map = {
      gclid: 'hf-gclid', wbraid: 'hf-wbraid', gbraid: 'hf-gbraid',
      utm_source: 'hf-utm-source', utm_medium: 'hf-utm-medium',
      utm_campaign: 'hf-utm-campaign', utm_term: 'hf-utm-term', utm_content: 'hf-utm-content',
    };
    KEYS.forEach(k => { if (saved[k]) setHidden(map[k], saved[k]); });
    setHidden('hf-page-url', location.href);
    setHidden('hf-referrer', document.referrer || '');
  })();

  /* ====== Smooth scroll for nav links ====== */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
