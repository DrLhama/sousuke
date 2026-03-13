/* ═══════════════════════════════════════════════════════════
   FOO — Calculadora de Batalha v3
   Campos nomeáveis como janelas filhas independentes
═══════════════════════════════════════════════════════════ */

window.GE_TRANSITION = function(canvas, done) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const COLORS = ['#f8a830','#e87010','#82dc30','#50b812','#ffd050','#b4f060','#c86010'];
  const leaves = Array.from({length: 90}, () => ({
    x: Math.random() * W * 1.3 - W * .15,
    y: -20 - Math.random() * H * .4,
    w: 8 + Math.random() * 16, h: 10 + Math.random() * 20,
    rot: Math.random() * Math.PI * 2, rotSpd: (Math.random() - .5) * .1,
    vx: (Math.random() - .4) * 2.5, vy: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: .65 + Math.random() * .35, shape: Math.floor(Math.random() * 3)
  }));

  let phase = 0, bgAlpha = 0, slideY = 0, navigated = false;
  const fallback = setTimeout(() => { if (!navigated) { navigated = true; done(); } }, 2500);

  function drawLeaf(l) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
    ctx.globalAlpha = l.alpha; ctx.fillStyle = l.color; ctx.beginPath();
    if (l.shape === 0) ctx.ellipse(0,0,l.w/2,l.h/2,0,0,Math.PI*2);
    else if (l.shape === 1) { ctx.moveTo(0,-l.h/2);ctx.lineTo(l.w/2,0);ctx.lineTo(0,l.h/2);ctx.lineTo(-l.w/2,0);ctx.closePath(); }
    else { ctx.moveTo(0,-l.h/2);ctx.bezierCurveTo(l.w/2,-l.h/4,l.w/2,l.h/4,0,l.h/2);ctx.bezierCurveTo(-l.w/2,l.h/4,-l.w/2,-l.h/4,0,-l.h/2); }
    ctx.fill(); ctx.restore();
  }

  function tick() {
    if (navigated) return;
    ctx.clearRect(0,0,W,H);

    if (phase === 0) {
      bgAlpha = Math.min(1, bgAlpha + 0.03);
      ctx.fillStyle = `rgba(6,4,0,${bgAlpha})`; ctx.fillRect(0,0,W,H);
      leaves.forEach(l => {
        l.x += l.vx + Math.sin(l.y*.012)*.8; l.y += l.vy; l.rot += l.rotSpd;
        if (l.y > H + 20) { l.y = -20; l.x = Math.random() * W; }
        drawLeaf(l);
      });
      if (bgAlpha >= 1) phase = 1;
    }

    if (phase === 1) {
      slideY += H * 0.048;
      const curtainH = Math.max(0, H - slideY);
      ctx.fillStyle = 'rgba(6,4,0,1)';
      ctx.fillRect(0, 0, W, curtainH);
      // leaves still swirling near curtain edge
      const edgeY = curtainH;
      leaves.forEach(l => {
        l.x += l.vx * 0.5; l.y += l.vy * 0.4; l.rot += l.rotSpd;
        if (Math.abs(l.y - edgeY) < 60) {
          ctx.globalAlpha = Math.max(0, (1 - Math.abs(l.y - edgeY) / 60)) * l.alpha * 0.6;
          drawLeaf(l); ctx.globalAlpha = 1;
        }
      });
      if (curtainH <= 0) {
        ctx.clearRect(0,0,W,H);
        clearTimeout(fallback);
        navigated = true; done(); return;
      }
    }

    requestAnimationFrame(tick);
  }
  tick();
};

/* ═══════════════════════════════════════════════════════════ */
(function() {

  // Lê HP/EA máximo da ficha em tempo real
  function readSheetStats() {
    // Procura na ficha pelos valores de HP/EA nas células .sv
    const cells = document.querySelectorAll('.sc');
    let hp = 15, ea = 20;
    cells.forEach(cell => {
      const lbl = cell.querySelector('.sl2');
      const val = cell.querySelector('.sv');
      if (!lbl || !val) return;
      const txt = lbl.textContent.trim().toLowerCase();
      const num = parseInt(val.textContent);
      if (txt === 'vida' && !isNaN(num)) hp = num;
      if (txt === 'ea inicial' && !isNaN(num)) ea = num;
    });
    return { hp, ea };
  }

  const sheetStats = readSheetStats();
  const S = { hp: sheetStats.hp, hpMax: sheetStats.hp, ea: sheetStats.ea, eaMax: sheetStats.ea, log: [],
    // EA armazenada na Ecobag (juros pausados)
    storedEa: [], nextStoredId: 1
  };
  let nextFieldId = 1;
  let fieldWindows = [];

  // Juros escalam infinitamente: T0-T7 tabela base, T8+ +8/turno
  function jurosValue(t) {
    const BASE = [0, 8, 12, 18, 26, 32, 40, 48];
    if (t <= 7) return BASE[t];
    return 48 + (t - 7) * 8;
  }

  function log(msg, type='info') {
    S.log.unshift({ msg, type, ts: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) });
    if (S.log.length > 80) S.log.pop();
    renderLog();
  }

  /* ── SHARED STYLES ── */
  const style = document.createElement('style');
  style.textContent = `
    .foo-win {
      position: fixed; z-index: 9000;
      background: rgba(22,16,4,.98);
      border: 1px solid rgba(200,90,10,.5);
      font-family: 'Inconsolata', monospace;
      display: flex; flex-direction: column;
      box-shadow: 0 0 32px rgba(232,112,16,.1), 0 8px 28px rgba(0,0,0,.85);
      resize: both; overflow: hidden;
      min-width: 260px; min-height: 120px;
    }
    .foo-win.minimized .fw-body { display: none; }

    .fw-titlebar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      background: rgba(140,50,5,.45);
      border-bottom: 1px solid rgba(200,90,10,.35);
      cursor: grab; user-select: none; flex-shrink: 0;
    }
    .fw-titlebar:active { cursor: grabbing; }
    .fw-drag-hint { font-size:.7rem; color:rgba(200,140,50,.3); margin-right:2px; flex-shrink:0; user-select:none; }
    .fw-title-input {
      flex: 1; background: transparent; border: none; outline: none;
      font-family: 'Inconsolata', monospace; font-size: .52rem;
      letter-spacing: .25em; text-transform: uppercase;
      color: rgba(255,185,65,.85); cursor: text;
    }
    .fw-title-input::placeholder { color: rgba(180,100,30,.3); }
    .fw-winbtns { display: flex; gap: 5px; margin-left: auto; flex-shrink: 0; }
    .fw-wbtn {
      width: 13px; height: 13px; border-radius: 50%; border: none;
      cursor: pointer; font-size: 8px; display: flex; align-items: center; justify-content: center; transition: filter .15s;
    }
    .fw-wbtn:hover { filter: brightness(1.5); }
    .fw-wbtn.min   { background: rgba(232,112,16,.5); color: rgba(4,2,0,.9); }
    .fw-wbtn.close { background: rgba(180,40,40,.5);  color: rgba(4,2,0,.9); }

    .fw-body {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .fw-body::-webkit-scrollbar { width: 3px; }
    .fw-body::-webkit-scrollbar-thumb { background: rgba(184,72,0,.3); }

    /* ── SECTIONS ── */
    .fs { border: 1px solid rgba(120,80,20,.3); background: rgba(255,255,255,.03); }
    .fs-head {
      padding: 5px 9px; border-bottom: 1px solid rgba(120,80,20,.25);
      font-size: .44rem; letter-spacing: .3em; text-transform: uppercase;
      color: rgba(232,140,40,.7); display: flex; align-items: center; justify-content: space-between;
    }
    .fs-body { padding: 9px; }

    /* ── RESOURCE ROWS ── */
    .res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .res-block { display: flex; flex-direction: column; gap: 4px; }
    .res-label { font-size: .42rem; letter-spacing: .25em; text-transform: uppercase; color: rgba(210,170,80,.65); }
    .res-bar { height: 6px; background: rgba(255,255,255,.05); border: 1px solid rgba(60,40,10,.25); position: relative; overflow: hidden; }
    .res-bar-fill { position: absolute; left:0;top:0;bottom:0; transition: width .3s; }
    .res-bar-fill.hp { background: linear-gradient(90deg,#50b812,#82dc30); }
    .res-bar-fill.ea { background: linear-gradient(90deg,#c86010,#f8a830); }
    .res-num { font-size: .75rem; color: rgba(248,210,100,.9); }
    .res-num em { color: rgba(180,140,60,.6); font-style: normal; font-size: .55rem; }
    .res-controls { display: flex; gap: 4px; align-items: center; margin-top: 2px; }

    /* ── BUTTONS ── */
    .fb {
      padding: 5px 8px; background: transparent;
      border: 1px solid rgba(150,100,25,.4); color: rgba(210,175,80,.75);
      font-family: 'Inconsolata', monospace; font-size: .46rem;
      letter-spacing: .1em; text-transform: uppercase;
      cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .fb:hover        { border-color: rgba(232,112,16,.5); color: rgba(248,168,48,.9); background: rgba(232,112,16,.05); }
    .fb.danger:hover { border-color: rgba(200,60,60,.5);  color: rgba(220,100,100,.9); background: rgba(180,40,40,.05); }
    .fb.heal:hover   { border-color: rgba(80,184,18,.5);  color: rgba(120,220,50,.9);  background: rgba(46,138,8,.05); }
    .fb.pri          { border-color: rgba(232,112,16,.4); color: rgba(255,185,65,.85); }
    .fb.sm           { padding: 3px 6px; font-size: .42rem; }

    .fi {
      background: rgba(255,255,255,.04); border: 1px solid rgba(70,50,10,.3);
      color: rgba(220,185,90,.8); font-family: 'Inconsolata', monospace;
      font-size: .68rem; padding: 4px 6px; outline: none; text-align: center;
      transition: border-color .15s; width: 52px;
    }
    .fi:focus { border-color: rgba(232,112,16,.5); }
    .fi.wide { width: 100%; text-align: left; }

    /* ── FIELD WINDOW ── */
    .fw-turno-badge {
      font-size: .9rem; color: rgba(255,195,70,.9); font-weight: bold;
      min-width: 20px; text-align: center;
    }
    .fw-turno-label { font-size: .44rem; color: rgba(190,150,65,.6); letter-spacing: .15em; }

    /* item rows */
    .item-list { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; min-height: 16px; }
    .item-row {
      display: grid; grid-template-columns: 1fr 44px 52px auto;
      gap: 4px; align-items: center;
      padding: 4px 6px; background: rgba(232,112,16,.07);
      border: 1px solid rgba(160,90,20,.28);
    }
    .item-name {
      background: transparent; border: none; outline: none;
      font-family: 'Inconsolata', monospace; font-size: .55rem;
      color: rgba(240,210,120,.9); letter-spacing: .1em;
    }
    .item-name::placeholder { color: rgba(120,80,20,.3); }
    .item-qty, .item-ea {
      background: rgba(255,255,255,.03); border: 1px solid rgba(70,50,10,.22);
      color: rgba(230,200,100,.9); font-family: 'Inconsolata', monospace;
      font-size: .55rem; padding: 2px 4px; outline: none; text-align: center;
      width: 100%;
    }
    .item-qty:focus, .item-ea:focus { border-color: rgba(232,112,16,.4); }
    .item-rem {
      padding: 2px 5px; background: transparent;
      border: 1px solid rgba(120,40,40,.2); color: rgba(180,70,70,.4);
      font-size: .42rem; cursor: pointer; font-family: 'Inconsolata', monospace;
      transition: all .15s;
    }
    .item-rem:hover { border-color: rgba(200,80,80,.5); color: rgba(220,110,110,.8); }

    .item-header {
      display: grid; grid-template-columns: 1fr 44px 52px auto;
      gap: 4px; padding: 2px 6px; margin-bottom: 2px;
    }
    .item-header span { font-size: .4rem; letter-spacing: .2em; text-transform: uppercase; color: rgba(180,130,55,.55); }

    /* ── LOG ── */
    .log-list { max-height: 100px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .log-list::-webkit-scrollbar { width: 2px; }
    .log-list::-webkit-scrollbar-thumb { background: rgba(184,72,0,.2); }
    .log-e { font-size: .48rem; line-height: 1.55; padding: 2px 0; border-bottom: 1px solid rgba(140,90,20,.12); display: flex; gap: 7px; }
    .log-e .ts  { color: rgba(100,70,20,.32); flex-shrink: 0; }
    .log-e .msg { flex: 1; }
    .log-e.damage .msg { color: rgba(220,100,80,.8); }
    .log-e.heal   .msg { color: rgba(100,200,60,.8); }
    .log-e.field  .msg { color: rgba(255,195,70,.9); }
    .log-e.ea     .msg { color: rgba(232,112,16,.8); }
    .log-e.info   .msg { color: rgba(180,150,80,.65); }
  `;
  document.head.appendChild(style);

  /* ── DRAGGABLE FACTORY ── */
  function makeDraggable(win, bar) {
    let drag = false, ox = 0, oy = 0;
    bar.addEventListener('mousedown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      drag = true;
      const r = win.getBoundingClientRect();
      win.style.left = r.left + 'px'; win.style.top = r.top + 'px';
      win.style.bottom = 'auto'; win.style.right = 'auto';
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      win.style.zIndex = '9200';
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const x = Math.max(-win.offsetWidth + 80, Math.min(window.innerWidth - 60, e.clientX - ox));
      const y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - oy));
      win.style.left = x + 'px'; win.style.top = y + 'px';
    });
    document.addEventListener('mouseup', () => { if (drag) { drag = false; win.style.zIndex = '9000'; } });
  }

  function recenter(win) {
    win.style.left = Math.max(0, (window.innerWidth - win.offsetWidth) / 2) + 'px';
    win.style.top  = Math.max(0, (window.innerHeight - win.offsetHeight) / 2) + 'px';
    win.style.bottom = 'auto'; win.style.right = 'auto';
    win.classList.remove('minimized');
  }

  /* ── MAIN WINDOW ── */
  const main = document.createElement('div');
  main.className = 'foo-win';
  main.style.cssText = 'width:440px;bottom:80px;right:24px;';
  main.innerHTML = `
    <div class="fw-titlebar" id="foo-main-bar">
      <span class="fw-drag-hint">⠿</span>
      <span style="font-size:.52rem;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,185,65,.85)">⚔ FOO · Batalha</span>
      <div class="fw-winbtns">
        <button class="fw-wbtn" id="foo-recenter-btn" title="Recentrar" style="background:rgba(180,120,40,.35);color:rgba(255,200,80,.8);border-radius:3px;width:auto;padding:0 6px;font-size:10px;">⊙</button>
        <button class="fw-wbtn min">─</button>
        <button class="fw-wbtn close">✕</button>
      </div>
    </div>
    <div class="fw-body">

      <!-- HP / EA em grid 2col -->
      <div class="fs">
        <div class="fs-head">Recursos</div>
        <div class="fs-body">
          <div class="res-grid">
            <div class="res-block">
              <div class="res-label">HP</div>
              <div class="res-bar"><div class="res-bar-fill hp" id="foo-hp-fill"></div></div>
              <div class="res-num" id="foo-hp-num">— <em>/ —</em></div>
              <div class="res-controls">
                <input class="fi" id="foo-hp-amt" value="1" type="number" min="1"
                  onkeydown="if(event.key==='Enter'){const n=parseFloat(this.value)||1;if(n<0)fooB.heal(-n);else fooB.dmg(n);}">
                <span style="font-size:.4rem;color:rgba(180,130,50,.45);letter-spacing:.1em">ENTER −HP / ENTER +HP (neg)</span>
              </div>
            </div>
            <div class="res-block">
              <div class="res-label">EA</div>
              <div class="res-bar"><div class="res-bar-fill ea" id="foo-ea-fill"></div></div>
              <div class="res-num" id="foo-ea-num">— <em>/ —</em></div>
              <div class="res-controls">
                <input class="fi" id="foo-ea-amt" value="1" type="number" min="1"
                  onkeydown="if(event.key==='Enter'){const n=parseFloat(this.value)||1;if(n<0)fooB.gainEa(-n);else fooB.useEa(n);}">
                <span style="font-size:.4rem;color:rgba(180,130,50,.45);letter-spacing:.1em">ENTER −EA / ENTER +EA (neg)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CAMPOS -->
      <div class="fs">
        <div class="fs-head">
          <span>Campos Germinados</span>
          <button class="fb pri sm" onclick="fooB.newField()">+ Novo Campo</button>
        </div>
        <div class="fs-body" id="foo-field-list" style="font-size:.48rem;color:rgba(120,90,35,.35);text-align:center;padding:8px 0">
          Nenhum campo ativo — clique em + Novo Campo
        </div>
      </div>

      <!-- EA ARMAZENADA — Ecobag -->
      <div class="fs" style="border-color:rgba(130,220,50,.2)">
        <div class="fs-head" style="color:rgba(130,220,50,.75);border-bottom-color:rgba(130,220,50,.18)">
          <span>📦 EA Armazenada · Ecobag</span>
          <button class="fb pri sm" onclick="fooB.storeEa()" style="border-color:rgba(100,200,40,.3);color:rgba(130,220,50,.8)">+ Guardar</button>
        </div>
        <div class="fs-body" style="padding:6px 9px">
          <div style="font-size:.42rem;color:rgba(140,200,70,.5);margin-bottom:6px;letter-spacing:.08em">
            EA guardada tem juros PAUSADOS — retomam ao plantar. Use pra chegar ao combate já carregado ou guardar EA de sementes detonadas.
          </div>
          <div class="res-controls" style="margin-bottom:6px">
            <input class="fi" id="foo-store-amt" value="8" type="number" min="1" title="Quantidade de EA" style="width:44px">
            <input class="fi wide" id="foo-store-lbl" placeholder="rótulo (ex: T+2 batata)" style="flex:1;width:auto"
              onkeydown="if(event.key==='Enter') fooB.storeEa()">
          </div>
          <div id="foo-stored-list" style="display:flex;flex-direction:column;gap:3px;min-height:10px"></div>
          <div style="margin-top:5px;font-size:.42rem;color:rgba(180,140,60,.4)" id="foo-stored-total">Total armazenado: 0 EA</div>
        </div>
      </div>

      <!-- LOG -->
      <div class="fs">
        <div class="fs-head">
          Log de Ações
          <button class="fb sm" onclick="fooB.clearLog()">Limpar</button>
        </div>
        <div class="fs-body"><div class="log-list" id="foo-log"></div></div>
      </div>

    </div>
  `;
  document.body.appendChild(main);
  makeDraggable(main, main.querySelector('#foo-main-bar'));
  main.querySelector('.fw-wbtn.min').addEventListener('click', () => main.classList.toggle('minimized'));
  main.querySelector('#foo-recenter-btn').addEventListener('click', () => recenter(main));
  main.querySelector('.fw-wbtn.close').addEventListener('click', () => {
    main.style.display = 'none';
    // Don't remove main, just hide — toggle still works
  });

  /* ── RENDER RESOURCES ── */
  function renderRes() {
    // sync max from sheet on every render
    const fresh = readSheetStats();
    if (fresh.hp !== S.hpMax) { S.hpMax = fresh.hp; S.hp = Math.min(S.hp, S.hpMax); }
    if (fresh.ea !== S.eaMax) { S.eaMax = fresh.ea; S.ea = Math.min(S.ea, S.eaMax); }
    document.getElementById('foo-hp-fill').style.width = Math.max(0, S.hp/S.hpMax*100)+'%';
    document.getElementById('foo-hp-num').innerHTML = `${S.hp} <em>/ ${S.hpMax}</em>`;
    document.getElementById('foo-ea-fill').style.width = Math.max(0, S.ea/S.eaMax*100)+'%';
    document.getElementById('foo-ea-num').innerHTML = `${S.ea} <em>/ ${S.eaMax}</em>`;
    if (window._fooUpdateToggle) window._fooUpdateToggle();
  }

  function renderLog() {
    const el = document.getElementById('foo-log');
    if (!el) return;
    el.innerHTML = S.log.map(e => `<div class="log-e ${e.type}"><span class="ts">${e.ts}</span><span class="msg">${e.msg}</span></div>`).join('');
  }

  function renderStoredEa() {
    const el = document.getElementById('foo-stored-list');
    const tot = document.getElementById('foo-stored-total');
    if (!el) return;
    if (S.storedEa.length === 0) {
      el.innerHTML = '<div style="font-size:.44rem;color:rgba(100,80,20,.3);text-align:center;padding:4px 0">— ecobag vazia —</div>';
    } else {
      el.innerHTML = S.storedEa.map(it => `
        <div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid rgba(100,180,40,.1)">
          <span style="font-size:.52rem;color:rgba(160,230,80,.8);flex:1">${it.lbl}</span>
          <span style="font-size:.6rem;color:rgba(180,230,100,.9);min-width:28px;text-align:right">${it.amt}</span>
          <span style="font-size:.4rem;color:rgba(120,170,50,.5)">EA</span>
          <button class="fb sm heal" onclick="fooB.releaseEa(${it.id})" title="Adicionar à EA atual">↑ EA</button>
          <button class="fb sm" onclick="fooB.plantStored(${it.id})" title="Plantar (juros retomam)" style="border-color:rgba(80,180,18,.3);color:rgba(100,210,40,.7)">🌱</button>
          <button class="fb sm danger" onclick="fooB.removeStored(${it.id})">✕</button>
        </div>`).join('');
    }
    const total = S.storedEa.reduce((s,x)=>s+x.amt,0);
    if (tot) tot.textContent = `Total armazenado: ${total} EA`;
  }

  /* ── FIELD WINDOWS ── */
  function renderFieldList() {
    const el = document.getElementById('foo-field-list');
    if (!el) return;
    if (fieldWindows.length === 0) {
      el.innerHTML = '<span style="font-size:.48rem;color:rgba(120,90,35,.35)">Nenhum campo ativo — clique em + Novo Campo</span>';
      return;
    }
    el.innerHTML = fieldWindows.map(f => `
      <div style="display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px solid rgba(60,40,10,.15)">
        <span style="font-size:.55rem;color:rgba(220,180,80,.6);flex:1">${f.name || 'Campo sem nome'}</span>
        <span style="font-size:.48rem;color:rgba(180,130,50,.4)">T+${f.turno} · ${f.items.length} item(s)</span>
        <button class="fb sm" onclick="fooB.focusField(${f.id})">Focar</button>
        <button class="fb sm danger" onclick="fooB.closeField(${f.id})">✕</button>
      </div>`).join('');
  }

  function createFieldWindow(id) {
    const f = { id, name: `Campo ${id}`, turno: 0, items: [], win: null };
    fieldWindows.push(f);

    const offsetX = 460 + (fieldWindows.length - 1) * 20;
    const offsetY = 80  + (fieldWindows.length - 1) * 28;

    const fw = document.createElement('div');
    fw.className = 'foo-win';
    fw.id = `foo-field-${id}`;
    fw.style.cssText = `width:380px;top:${offsetY}px;right:${offsetX}px;`;
    fw.innerHTML = `
      <div class="fw-titlebar" id="foo-fbar-${id}">
        <input class="fw-title-input" value="${f.name}" placeholder="Nome do campo"
          oninput="fooB.renameField(${id},this.value)">
        <div class="fw-winbtns">
          <span class="fw-turno-label">T+</span>
          <span class="fw-turno-badge" id="ft-badge-${id}">0</span>
          <button class="fw-wbtn" onclick="fooB.recenterField(${id})" title="Recentrar" style="background:rgba(180,120,40,.35);color:rgba(255,200,80,.8);border-radius:3px;width:auto;padding:0 6px;font-size:10px;">⊙</button>
          <button class="fw-wbtn min">─</button>
          <button class="fw-wbtn close">✕</button>
        </div>
      </div>
      <div class="fw-body">

        <!-- turno controls -->
        <div class="fs">
          <div class="fs-head">Turno do Campo</div>
          <div class="fs-body" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="fb pri" onclick="fooB.advFieldTurn(${id})">▶ Avançar Turno</button>
            <button class="fb"     onclick="fooB.resetFieldTurn(${id})">↺ Zerar</button>
            <span id="ft-info-${id}" style="font-size:.48rem;color:rgba(200,155,70,.5);flex:1"></span>
          </div>
        </div>

        <!-- itens -->
        <div class="fs">
          <div class="fs-head">
            Itens Plantados
            <button class="fb sm pri" onclick="fooB.addItem(${id})">+ Item</button>
          </div>
          <div class="fs-body">
            <div class="item-header">
              <span>Nome</span><span style="text-align:center">Qtd</span><span style="text-align:center">EA</span><span></span>
            </div>
            <div class="item-list" id="fitems-${id}"></div>
          </div>
        </div>

        <!-- detonar -->
        <div class="fs">
          <div class="fs-head">Detonação</div>
          <div class="fs-body" style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="fb pri" style="flex:1" onclick="fooB.detonate(${id})">💥 Detonar</button>
            <button class="fb heal" onclick="fooB.eaRecuperavel(${id})" title="EA total × turno">💚 EA Recup.</button>
            <button class="fb danger" onclick="fooB.clearItems(${id})">✕ Limpar</button>
          </div>
          <div style="font-size:.42rem;color:rgba(190,150,65,.5);padding:5px 0 0;letter-spacing:.08em">EA recuperável = EA investida total × turno atual</div>
        </div>

      </div>
    `;
    document.body.appendChild(fw);
    f.win = fw;

    makeDraggable(fw, fw.querySelector(`#foo-fbar-${id}`));
    fw.querySelector('.fw-wbtn.min').addEventListener('click', () => fw.classList.toggle('minimized'));
    fw.querySelector('.fw-wbtn.close').addEventListener('click', () => fooB.closeField(id));

    renderFieldItems(id);
    renderFieldList();
    updateFieldInfo(id);
    return f;
  }

  function renderFieldItems(id) {
    const f = fieldWindows.find(x => x.id === id);
    if (!f) return;
    const el = document.getElementById(`fitems-${id}`);
    if (!el) return;
    if (f.items.length === 0) {
      el.innerHTML = '<div style="font-size:.46rem;color:rgba(100,75,25,.3);padding:4px 0;text-align:center">— vazio —</div>';
      return;
    }
    el.innerHTML = f.items.map((it, i) => `
      <div class="item-row">
        <input class="item-name" value="${it.name}" placeholder="item..."
          oninput="fooB.editItem(${id},${i},'name',this.value)">
        <input class="item-qty" type="number" min="0" value="${it.qty}"
          oninput="fooB.editItem(${id},${i},'qty',this.value)" title="Quantidade">
        <input class="item-ea" type="number" min="0" value="${it.ea}"
          oninput="fooB.editItem(${id},${i},'ea',this.value)" title="EA investida">
        <button class="item-rem" onclick="fooB.removeItem(${id},${i})">✕</button>
      </div>`).join('');
  }

  const JUROS_LABEL = ['—','T+1: 8','T+2: 12','T+3: 18','T+4: 26','T+5: 32','T+6: 40','T+7+: 48'];
  function updateFieldInfo(id) {
    const f = fieldWindows.find(x => x.id === id);
    if (!f) return;
    const badge = document.getElementById(`ft-badge-${id}`);
    const info  = document.getElementById(`ft-info-${id}`);
    if (badge) badge.textContent = f.turno;
    if (info) {
      const juros = jurosValue(f.turno);
      const totalEa = f.items.reduce((s,i)=>s+(parseInt(i.ea)||0),0);
      const totalQty = f.items.reduce((s,i)=>s+(parseInt(i.qty)||0),0);
      info.textContent = `+${juros} base · ${totalQty} plantas · ${totalEa} EA inv · recup: ${totalEa * f.turno} EA`;
    }
  }

  function getAmt(id) { return Math.max(1, parseInt(document.getElementById(id)?.value)||1); }

  /* ── PUBLIC API ── */
  window.fooB = {
    dmg(v)  { v=v||getAmt('foo-hp-amt'); S.hp=Math.max(0,S.hp-v); log(`Tomou ${v} dano · HP ${S.hp}/${S.hpMax}`,'damage'); renderRes(); },
    heal(v) { v=v||getAmt('foo-hp-amt'); S.hp=Math.min(S.hpMax,S.hp+v); log(`Curou ${v} · HP ${S.hp}/${S.hpMax}`,'heal'); renderRes(); },
    useEa(v){ v=v||getAmt('foo-ea-amt'); if(S.ea<v){log(`EA insuficiente (${S.ea})`,'info');return;} S.ea-=v; log(`−${v} EA · ${S.ea}/${S.eaMax}`,'ea'); renderRes(); },
    gainEa(v){ v=v||getAmt('foo-ea-amt'); S.ea=Math.min(S.eaMax,S.ea+v); log(`+${v} EA · ${S.ea}/${S.eaMax}`,'heal'); renderRes(); },

    storeEa() {
      const amt = parseInt(document.getElementById('foo-store-amt')?.value)||0;
      const lbl = document.getElementById('foo-store-lbl')?.value||'EA';
      if (amt <= 0) return;
      S.storedEa.push({ id: S.nextStoredId++, amt, lbl });
      log(`📦 Guardou ${amt} EA na Ecobag: "${lbl}"`, 'field');
      renderStoredEa();
    },
    releaseEa(id) {
      const item = S.storedEa.find(x=>x.id===id);
      if (!item) return;
      S.storedEa = S.storedEa.filter(x=>x.id!==id);
      S.ea = Math.min(S.eaMax, S.ea + item.amt);
      log(`📦 Retirou ${item.amt} EA da Ecobag: "${item.lbl}" · EA ${S.ea}/${S.eaMax}`, 'heal');
      renderRes(); renderStoredEa();
    },
    plantStored(id) {
      const item = S.storedEa.find(x=>x.id===id);
      if (!item) return;
      S.storedEa = S.storedEa.filter(x=>x.id!==id);
      log(`🌱 Plantou EA da Ecobag: "${item.lbl}" (${item.amt} EA) — juros retomam do ponto pausado`, 'field');
      renderStoredEa();
    },

    newField() { const f = createFieldWindow(nextFieldId++); log(`Campo "${f.name}" criado`,'field'); },
    closeField(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f?.win) f.win.remove();
      fieldWindows = fieldWindows.filter(x=>x.id!==id);
      log(`Campo #${id} fechado`,'info');
      renderFieldList();
    },
    focusField(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (!f?.win) return;
      f.win.style.zIndex = '9100';
      f.win.classList.remove('minimized');
      setTimeout(()=>{ f.win.style.zIndex='9000'; },800);
    },
    renameField(id, nome) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f) { f.name = nome; renderFieldList(); }
    },
    advFieldTurn(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (!f) return;
      f.turno = f.turno + 1;
      const juros = jurosValue(f.turno);
      log(`"${f.name||'Campo '+id}" T+${f.turno} · bônus base +${juros}`,'field');
      updateFieldInfo(id);
    },
    resetFieldTurn(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f) { f.turno=0; updateFieldInfo(id); log(`"${f.name||'Campo '+id}" turno zerado`,'info'); }
    },
    detonate(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (!f) return;
      const juros = jurosValue(f.turno);
      const totalQty = f.items.reduce((s,i)=>s+(parseInt(i.qty)||0),0);
      const totalEa  = f.items.reduce((s,i)=>s+(parseInt(i.ea)||0),0);
      log(`💥 "${f.name||'Campo '+id}" detonado · T+${f.turno} · +${juros} base · ${totalQty} plantas · ${totalEa} EA · 8d6+2d4+5 dano`,'field');
      f.items=[]; f.turno=0;
      renderFieldItems(id); updateFieldInfo(id);
    },
    clearItems(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f) { f.items=[]; renderFieldItems(id); updateFieldInfo(id); log(`Itens de "${f.name||'Campo '+id}" limpos`,'info'); }
    },
    addItem(id) {
      const f = fieldWindows.find(x=>x.id===id);
      if (!f) return;
      f.items.push({ name:'', qty:1, ea:0 });
      renderFieldItems(id); updateFieldInfo(id);
    },
    editItem(id,i,key,val) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f?.items[i] !== undefined) {
        f.items[i][key] = (key === 'name') ? val : (parseFloat(val) || 0);
        updateFieldInfo(id); // only update the summary, don't re-render the list
      }
    },
    removeItem(id,i) {
      const f = fieldWindows.find(x=>x.id===id);
      if (f) { f.items.splice(i,1); renderFieldItems(id); updateFieldInfo(id); }
    },
    clearLog() { S.log=[]; renderLog(); },
    recenterField(id) { const f=fieldWindows.find(x=>x.id===id); if(f?.win) recenter(f.win); },
    removeStored(id) {
      S.storedEa = S.storedEa.filter(x=>x.id!==id);
      renderStoredEa();
    },
    eaRecuperavel(id) {
      const f = fieldWindows.find(x => x.id === id); if (!f) return;
      const totalEa = f.items.reduce((s,i) => s + (parseFloat(i.ea) || 0), 0);
      const valor = totalEa * f.turno;
      const nome = f.name || ('Campo ' + id);
      log('💚 "' + nome + '" EA recuperável: ' + totalEa + ' × T' + f.turno + ' = ' + valor + ' EA', 'heal');
    }
  };

  renderRes();
  renderStoredEa();
  log(`Calculadora iniciada · HP ${S.hpMax} · EA ${S.eaMax}`,'info');

  const ts = document.createElement('style');
  ts.textContent = `
    #foo-calc-toggle {
      position:fixed;bottom:64px;right:24px;z-index:8001;
      font-family:'Inconsolata',monospace;
      padding:0;border:1px solid rgba(184,72,0,.4);
      background:rgba(6,4,0,.95);cursor:pointer;backdrop-filter:blur(8px);transition:all .25s;
      display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 0 20px rgba(232,112,16,.08),0 4px 16px rgba(0,0,0,.7);
    }
    #foo-calc-toggle:hover { border-color:rgba(248,168,48,.65);box-shadow:0 0 30px rgba(232,112,16,.18),0 4px 18px rgba(0,0,0,.8); }
    #foo-calc-toggle .ftb-main {
      padding:8px 14px;font-size:.48rem;letter-spacing:.28em;text-transform:uppercase;color:rgba(232,112,16,.6);
      border-bottom:1px solid rgba(184,72,0,.25);display:flex;align-items:center;gap:8px;
    }
    #foo-calc-toggle:hover .ftb-main { color:rgba(248,168,48,.95); }
    #foo-calc-toggle .ftb-stats {
      display:grid;grid-template-columns:1fr 1fr;gap:0;
    }
    #foo-calc-toggle .ftb-stat {
      padding:5px 10px;font-size:.42rem;letter-spacing:.1em;text-transform:uppercase;
      color:rgba(140,100,30,.55);border-right:1px solid rgba(80,50,5,.25);
    }
    #foo-calc-toggle .ftb-stat:last-child { border-right:none; }
    #foo-calc-toggle .ftb-stat strong { display:block;font-size:.62rem;letter-spacing:0;font-family:'Inconsolata',monospace; }
    #foo-calc-toggle .ftb-stat.hp-stat strong { color:rgba(80,184,18,.85); }
    #foo-calc-toggle .ftb-stat.ea-stat strong { color:rgba(232,112,16,.85); }
    #foo-calc-toggle .ftb-info {
      padding:4px 10px;font-size:.4rem;letter-spacing:.08em;color:rgba(110,80,20,.5);
      border-top:1px solid rgba(80,50,5,.2);text-align:center;
    }
  `;
  document.head.appendChild(ts);
  const tb = document.createElement('button');
  tb.id = 'foo-calc-toggle';
  tb.innerHTML = `
    <div class="ftb-main">⚔ FOO · Batalha</div>
    <div class="ftb-stats">
      <div class="ftb-stat hp-stat">HP<strong id="ftb-hp">—</strong></div>
      <div class="ftb-stat ea-stat">EA<strong id="ftb-ea">—</strong></div>
    </div>
    <div class="ftb-info">8d6+2d4+5 · Def 13 · DT Mod+9</div>
  `;

  function updateToggleStats() {
    const h = document.getElementById('ftb-hp');
    const e = document.getElementById('ftb-ea');
    if (h) h.textContent = `${S.hp}/${S.hpMax}`;
    if (e) e.textContent = `${S.ea}/${S.eaMax}`;
  }

  // Patch renderRes to also update toggle
  const _origRenderRes = renderRes;
  // We'll call updateToggleStats from renderRes inline below by overriding
  const _renderResOrig = renderRes;
  window._fooUpdateToggle = updateToggleStats;

  tb.addEventListener('click', () => {
    main.style.display = main.style.display === 'none' ? 'flex' : 'none';
    updateToggleStats();
  });
  document.body.appendChild(tb);
  main.style.display = 'none';
  // Initial stats on toggle
  setTimeout(updateToggleStats, 100);

})();
