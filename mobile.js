/* LFA: navegación móvil, tablas legibles y draft por rondas. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const media = window.matchMedia('(max-width: 820px)');
  const btn = $('mobileMenuToggle');
  const dockMenu = $('mobileDockMenu');
  const backdrop = $('mobileNavBackdrop');
  const nav = $('mainNavigation');
  const dock = $('mobileDock');
  if (!btn || !nav || !dock || !backdrop) return;

  const isOpen = () => document.body.classList.contains('mobile-nav-open');
  function menu(open) {
    const active = !!open && media.matches;
    document.body.classList.toggle('mobile-nav-open', active);
    btn.setAttribute('aria-expanded', String(active));
    dockMenu.setAttribute('aria-expanded', String(active));
    btn.setAttribute('aria-label', active ? 'Cerrar menú' : 'Abrir menú de secciones');
    backdrop.hidden = !active;
  }
  function sync() {
    const current = document.querySelector('.view.active')?.dataset.view || 'inicio';
    dock.querySelectorAll('[data-go]').forEach(b => {
      const active = b.dataset.go === current;
      b.classList.toggle('is-selected', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    dockMenu.classList.toggle('is-selected', !['inicio','temporada','noticias'].includes(current) && !isOpen());
  }
  btn.addEventListener('click', () => menu(!isOpen()));
  dockMenu.addEventListener('click', () => menu(!isOpen()));
  backdrop.addEventListener('click', () => menu(false));
  nav.addEventListener('click', e => { if (e.target.closest('[data-page]')) menu(false); });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-page],[data-go]')) { menu(false); sync(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { menu(false); btn.focus(); }
  });
  if (media.addEventListener) media.addEventListener('change', () => { menu(false); sync(); });
  else media.addListener(() => { menu(false); sync(); });
  sync();
  // También sincroniza el acceso rápido cuando una función abre una sección
  // desde un partido o una noticia, sin tocar un botón de navegación.
  const viewObserver = new MutationObserver(sync);
  document.querySelectorAll('.view').forEach(view =>
    viewObserver.observe(view, {attributes:true, attributeFilter:['class']})
  );

  const containers = ['rosterGrid'];
  const compactContainers = ['standingsLive','legacyRanks','seasonRecords','h2hResult','h2hTable','h2h2026','standings2025','championsList'];
  function decorate(container) {
    if (!container) return;
    container.querySelectorAll('table:not(.draftboard)').forEach(table => {
      const heads = [...table.querySelectorAll('thead th')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
      if (!heads.length) return;
      table.classList.add('mobile-stack-table');
      table.querySelectorAll('tbody tr').forEach(row => {
        [...row.children].forEach((cell,i) => {
          if (cell.tagName === 'TD') cell.dataset.label = heads[i] || 'Dato';
        });
      });
    });
  }
  containers.forEach(id => {
    const target = $(id);
    if (!target) return;
    decorate(target);
    new MutationObserver(() => decorate(target)).observe(target, {childList:true});
  });

  function makeCompact(container) {
    if (!container) return;
    container.querySelectorAll('table:not(.draftboard)').forEach(t => {
      t.classList.remove('mobile-stack-table');
      t.classList.add('mobile-compact-table');
      t.querySelectorAll('td[data-label]').forEach(c => c.removeAttribute('data-label'));
    });
  }
  compactContainers.forEach(id => {
    const target = $(id);
    if (!target) return;
    makeCompact(target);
    new MutationObserver(() => makeCompact(target)).observe(target, {childList:true});
  });

  const root = $('draftData');
  function drawDraftCards() {
    if (!root || root.querySelector('.mobile-draft-board')) return;
    const board = root.querySelector('table.draftboard');
    if (!board) return;
    const headers = [...board.querySelectorAll('thead th')].slice(1);
    const rounds = [...board.querySelectorAll('tbody tr')];
    if (!rounds.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'mobile-draft-board';
    const guide = document.createElement('p');
    guide.className = 'mobile-draft-guide';
    guide.textContent = 'Elegí una ronda arriba. En el celular los picks se muestran por franquicia.';
    wrapper.appendChild(guide);
    rounds.forEach(row => {
      const cells = [...row.children];
      const section = document.createElement('section');
      section.className = 'draft-mobile-round';
      const title = document.createElement('h4');
      title.textContent = 'Ronda ' + (cells[0]?.textContent || '').replace(/[^0-9]/g, '');
      section.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'draft-mobile-grid';
      cells.slice(1).forEach((cell,i) => {
        const card = document.createElement('article');
        card.className = 'draft-mobile-card';
        const header = headers[i]?.querySelector('.draft-slot-owner');
        if (header) card.appendChild(header.cloneNode(true));
        const pick = cell.querySelector('.pick');
        if (pick) card.appendChild(pick.cloneNode(true));
        grid.appendChild(card);
      });
      section.appendChild(grid);
      wrapper.appendChild(section);
    });
    root.appendChild(wrapper);
    root.classList.add('has-mobile-draft');
  }
  if (root) {
    drawDraftCards();
    new MutationObserver(drawDraftCards).observe(root,{childList:true});
  }
})();
