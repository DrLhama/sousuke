/* ═══════════════════════════════════════════════════════════
   GOLDEN ERA — engine.js
   Sistema compartilhado: edição inline, reveal, navegação
   ═══════════════════════════════════════════════════════════

   Para usar em sheets/*.html:
     <script src="../engine.js"></script>
     engine.init()  ← chamado no DOMContentLoaded

   Para adicionar uma nova ficha ao index, registre em:
     ROSTER (no index.html)
═══════════════════════════════════════════════════════════ */

const engine = (() => {

  /* ──────────────────────────────────────────
     REVEAL ON SCROLL
  ────────────────────────────────────────── */
  function initReveals() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 45);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.07 });
    document.querySelectorAll('.reveal').forEach(r => obs.observe(r));
  }

  /* ──────────────────────────────────────────
     TECHNIQUE TOGGLE (accordion)
  ────────────────────────────────────────── */
  function T(header) {
    const body = header.nextElementSibling;
    const hint = header.querySelector('.hint');
    body.classList.toggle('open');
    if (hint) hint.textContent = body.classList.contains('open') ? '[−]' : '[+]';
  }

  /* ──────────────────────────────────────────
     EDIT SYSTEM
  ────────────────────────────────────────── */
  let editMode = false;
  const STORAGE_KEY = () => 'ge-edits-' + (document.documentElement.dataset.char || 'unknown');

  function markEditables() {
    const selectors = [
      '.sv', '.b', '.cepitaph', '.cid', '.csub', '.cname',
      '.dname', '.djp', '.origem-title', '.origem-sub',
      '.bc-v', '.rst', '.rss', '.hst', '.hss',
      '.tptitle', '.tpsub', '.ltitle', '.lphase',
      '.tn', '.tc', '.tjp', '.ssv', '.sname', '.sjp',
      '.av', '.anote', '.sl2', '.psn', '.psv',
      '.footnote', '.mech', '.harv-box', '.rotbox'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (!el.dataset.edit) {
          el.dataset.edit = sel.replace(/[^a-z0-9]/gi, '-') + '-' + i;
        }
      });
    });
  }

  function toggleEdit() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    document.querySelectorAll('[data-edit]').forEach(el => {
      el.contentEditable = editMode ? 'true' : 'false';
    });
    const btn = document.getElementById('eb-toggle');
    const status = document.getElementById('eb-status');
    const hint = document.getElementById('eb-hint');
    if (btn) {
      btn.classList.toggle('active', editMode);
      btn.textContent = editMode ? '✎ Editando' : '✎ Editar';
    }
    if (status) {
      status.textContent = editMode ? '● Edição ativa' : '● Edição desativada';
      status.className = 'eb-status ' + (editMode ? 'on' : 'off');
    }
    if (hint) {
      hint.textContent = editMode
        ? 'Clique em qualquer texto para editar · Enter para nova linha'
        : 'Ative para editar qualquer texto diretamente';
    }
  }

  function saveEdits() {
    const saves = {};
    document.querySelectorAll('[data-edit]').forEach(el => {
      saves[el.dataset.edit] = el.innerHTML;
    });
    try {
      localStorage.setItem(STORAGE_KEY(), JSON.stringify(saves));
      flashIndicator();
    } catch (e) {
      alert('Erro ao salvar. Verifique se o localStorage está disponível.');
    }
  }

  function loadEdits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY());
      if (!raw) return;
      const saves = JSON.parse(raw);
      Object.entries(saves).forEach(([key, val]) => {
        const el = document.querySelector('[data-edit="' + key + '"]');
        if (el) el.innerHTML = val;
      });
    } catch (e) {}
  }

  function resetEdits() {
    const char = document.documentElement.dataset.char || 'esta ficha';
    if (!confirm('Apagar todas as edições salvas de ' + char + '?\nIsso não pode ser desfeito.')) return;
    try {
      localStorage.removeItem(STORAGE_KEY());
      location.reload();
    } catch (e) {}
  }

  function flashIndicator() {
    const el = document.getElementById('eb-saved');
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ──────────────────────────────────────────
     EDIT BAR — injeta a barra de edição na página
  ────────────────────────────────────────── */
  function injectEditBar() {
    const bar = document.createElement('div');
    bar.id = 'edit-bar';
    bar.innerHTML = `
      <div class="eb-left">
        <a class="eb-btn back-btn" href="../index.html">← Fichas</a>
        <div class="eb-status off" id="eb-status">● Edição desativada</div>
        <div class="eb-hint" id="eb-hint">Ative para editar qualquer texto diretamente</div>
      </div>
      <div class="eb-right">
        <span class="eb-save-indicator" id="eb-saved">✓ Salvo</span>
        <button class="eb-btn reset-btn" onclick="engine.resetEdits()" title="Apagar edições salvas">↺ Resetar</button>
        <button class="eb-btn save-btn" onclick="engine.saveEdits()">↓ Salvar</button>
        <button class="eb-btn toggle-edit" id="eb-toggle" onclick="engine.toggleEdit()">✎ Editar</button>
      </div>
    `;
    document.body.appendChild(bar);
  }

  /* ──────────────────────────────────────────
     SHARED CSS — injeta estilos do engine
  ────────────────────────────────────────── */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Edit bar */
      #edit-bar {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 8000;
        display: flex; align-items: center; justify-content: space-between;
        padding: 11px 24px;
        background: rgba(4,3,1,.96);
        border-top: 1px solid rgba(100,80,20,.18);
        backdrop-filter: blur(10px);
        font-family: 'Inconsolata', monospace;
        gap: 12px;
      }
      .eb-left, .eb-right { display: flex; align-items: center; gap: 14px; }
      .eb-status { font-size: .52rem; letter-spacing: .3em; text-transform: uppercase; }
      .eb-status.off { color: rgba(120,100,50,.4); }
      .eb-status.on  { color: rgba(106,200,80,.7); }
      .eb-hint { font-size: .48rem; letter-spacing: .18em; color: rgba(100,80,40,.3); }
      .eb-btn {
        font-family: 'Inconsolata', monospace; font-size: .5rem;
        letter-spacing: .28em; text-transform: uppercase;
        padding: 7px 16px; border: 1px solid; cursor: pointer;
        background: transparent; transition: all .2s; text-decoration: none;
        display: inline-block;
      }
      .eb-btn.back-btn    { border-color: rgba(80,60,20,.28); color: rgba(140,120,60,.45); }
      .eb-btn.back-btn:hover { border-color: rgba(160,130,60,.5); color: rgba(200,170,80,.8); background: rgba(100,80,20,.06); }
      .eb-btn.toggle-edit { border-color: rgba(100,80,40,.3); color: rgba(180,160,80,.5); }
      .eb-btn.toggle-edit:hover { border-color: rgba(180,160,80,.55); color: rgba(220,200,100,.85); background: rgba(140,110,30,.06); }
      .eb-btn.toggle-edit.active { border-color: rgba(80,180,60,.5); color: rgba(100,220,70,.9); background: rgba(50,140,20,.07); }
      .eb-btn.save-btn    { border-color: rgba(60,140,30,.35); color: rgba(100,200,60,.6); }
      .eb-btn.save-btn:hover { border-color: rgba(100,200,60,.6); color: rgba(140,230,90,.95); background: rgba(50,140,20,.07); }
      .eb-btn.reset-btn   { border-color: rgba(139,26,26,.22); color: rgba(200,80,80,.38); font-size: .45rem; }
      .eb-btn.reset-btn:hover { border-color: rgba(200,80,80,.45); color: rgba(230,110,110,.75); }
      .eb-save-indicator  { font-size: .48rem; letter-spacing: .2em; color: rgba(100,220,70,.55); opacity: 0; transition: opacity .5s; }
      .eb-save-indicator.show { opacity: 1; }

      /* Extra padding so content doesn't hide under the bar */
      body { padding-bottom: 52px; }

      /* Edit mode — editable element hints */
      body.edit-mode [data-edit] {
        cursor: text;
        outline: 1px dashed rgba(180,160,80,.18);
        outline-offset: 2px;
        border-radius: 2px;
        transition: outline-color .2s, background .2s;
      }
      body.edit-mode [data-edit]:hover {
        outline-color: rgba(180,160,80,.45);
        background: rgba(180,160,80,.04) !important;
      }
      body.edit-mode [data-edit]:focus {
        outline-color: rgba(200,180,100,.7);
        background: rgba(180,160,80,.07) !important;
      }

      /* Respect reduced motion */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: .01ms !important;
          transition-duration: .01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ──────────────────────────────────────────
     INIT — call this from each sheet
  ────────────────────────────────────────── */
  function init() {
    injectStyles();
    injectEditBar();
    markEditables();
    loadEdits();
    initReveals();
  }

  /* public API */
  return { init, T, toggleEdit, saveEdits, resetEdits, initReveals };

})();

/* Make T globally available since it's called inline via onclick="T(this)" */
function T(h) { engine.T(h); }
