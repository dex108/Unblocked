/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getAllGames,
  saveCustomGame,
  deleteCustomGame,
  getFavorites,
  toggleFavorite,
  getRecentlyPlayed,
  recordGamePlay,
  extractIframeAttributes,
} from './storage.js';

// Application State
let games = [];
let currentCategory = 'All';
let searchQuery = '';
let sortBy = 'popular';
let favorites = [];
let recentlyPlayedIds = [];
let activeGame = null;
let isTheater = false;

// Tab Cloak Presets
const CLOAK_PRESETS = [
  {
    name: 'Google Docs',
    title: 'Document - Google Docs',
    icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  },
  {
    name: 'Google Classroom',
    title: 'Classes',
    icon: 'https://ssl.gstatic.com/classroom/favicon.png',
  },
  {
    name: 'Canvas LMS',
    title: 'Dashboard | Canvas',
    icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico',
  },
  {
    name: 'Wikipedia',
    title: 'Wikipedia, the free encyclopedia',
    icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
  },
];
let activeCloak = null;

// Initialize App on DOM Ready
function init() {
  games = getAllGames();
  favorites = getFavorites();
  recentlyPlayedIds = getRecentlyPlayed();

  renderHero();
  renderRecent();
  renderGamesGrid();
  renderCategoryBar();
  renderFavBadge();
  setupEventListeners();
  setupCloakPresets();
}

function renderHero() {
  const heroSection = document.getElementById('hero-banner-section');
  if (currentCategory !== 'All' || searchQuery.trim()) {
    heroSection.classList.add('hidden');
    return;
  }
  heroSection.classList.remove('hidden');

  const featured = games.find((g) => g.featured) || games[0];
  if (!featured) return;

  document.getElementById('hero-category').textContent = featured.category;
  document.getElementById('hero-plays').textContent = `${featured.plays.toLocaleString()} Plays`;
  document.getElementById('hero-title').textContent = featured.title;
  document.getElementById('hero-desc').textContent = featured.description;
  document.getElementById('hero-controls').textContent = featured.controls;
  document.getElementById('hero-rating').textContent = `★ ${featured.rating.toFixed(1)}`;
  document.getElementById('hero-total-games').textContent = `${games.length} Games`;

  const launchBtn = document.getElementById('hero-launch-btn');
  launchBtn.onclick = () => openGame(featured);
}

function renderRecent() {
  const recentSection = document.getElementById('recent-section');
  const recentGrid = document.getElementById('recent-grid');

  if (currentCategory !== 'All' || searchQuery.trim() || recentlyPlayedIds.length === 0) {
    recentSection.classList.add('hidden');
    return;
  }

  const recentGames = recentlyPlayedIds
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean);

  if (recentGames.length === 0) {
    recentSection.classList.add('hidden');
    return;
  }

  recentSection.classList.remove('hidden');
  recentGrid.innerHTML = '';

  recentGames.slice(0, 8).forEach((game) => {
    const btn = document.createElement('button');
    btn.className =
      'group flex flex-col items-center rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-center transition-all hover:border-amber-500/40 hover:bg-slate-900 cursor-pointer';
    btn.innerHTML = `
      <div class="mb-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-transform group-hover:scale-105" style="background: ${game.accentColor}20">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="${game.accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" x2="10" y1="12" y2="12"></line>
          <line x1="8" x2="8" y1="10" y2="14"></line>
          <line x1="15" x2="15.01" y1="13" y2="13"></line>
          <line x1="18" x2="18.01" y1="11" y2="11"></line>
          <rect width="20" height="12" x="2" y="6" rx="6"></rect>
        </svg>
      </div>
      <span class="font-display text-xs font-semibold text-slate-200 truncate w-full group-hover:text-amber-400">${game.title}</span>
      <span class="text-[10px] text-slate-500">${game.category}</span>
    `;
    btn.onclick = () => openGame(game);
    recentGrid.appendChild(btn);
  });
}

function getFilteredAndSortedGames() {
  const filtered = games.filter((game) => {
    if (currentCategory === 'Favorites') {
      if (!favorites.includes(game.id)) return false;
    } else if (currentCategory !== 'All') {
      if (game.category !== currentCategory) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = game.title.toLowerCase().includes(q);
      const matchDesc = game.description.toLowerCase().includes(q);
      const matchCat = game.category.toLowerCase().includes(q);
      const matchTag = game.tags && game.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchCat && !matchTag) return false;
    }

    return true;
  });

  if (sortBy === 'popular') {
    return filtered.sort((a, b) => b.plays - a.plays);
  }
  if (sortBy === 'rating') {
    return filtered.sort((a, b) => b.rating - a.rating);
  }
  if (sortBy === 'alphabetical') {
    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortBy === 'newest') {
    return filtered.sort((a, b) => (b.isCustom ? 1 : 0) - (a.isCustom ? 1 : 0));
  }
  return filtered;
}

function renderGamesGrid() {
  const grid = document.getElementById('games-grid');
  const emptyState = document.getElementById('empty-state');
  const countLabel = document.getElementById('games-count-label');
  const sectionTitle = document.getElementById('current-section-title');
  const matchingLabel = document.getElementById('search-matching-label');
  const searchTermText = document.getElementById('search-term-text');

  const visibleGames = getFilteredAndSortedGames();

  // Update section title
  if (currentCategory === 'Favorites') {
    sectionTitle.textContent = 'Your Bookmarked Favorites';
  } else if (currentCategory === 'All') {
    sectionTitle.textContent = 'All Available Games';
  } else {
    sectionTitle.textContent = `${currentCategory} Games`;
  }

  if (searchQuery.trim()) {
    matchingLabel.classList.remove('hidden');
    searchTermText.textContent = searchQuery;
  } else {
    matchingLabel.classList.add('hidden');
  }

  countLabel.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'game' : 'games'}`;

  grid.innerHTML = '';

  if (visibleGames.length === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  emptyState.classList.add('hidden');

  visibleGames.forEach((game) => {
    const isFav = favorites.includes(game.id);

    const card = document.createElement('div');
    card.className =
      'group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900 hover:shadow-xl cursor-pointer';

    card.innerHTML = `
      <div>
        <div class="relative mb-3.5 aspect-video w-full overflow-hidden rounded-lg bg-slate-950 border border-slate-800/80">
          ${
            game.thumbnailUrl
              ? `<img src="${game.thumbnailUrl}" alt="${game.title}" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />`
              : `<div class="flex h-full w-full items-center justify-center" style="background: radial-gradient(circle at 50% 50%, ${game.accentColor}25 0%, #030712 100%)">
                  <svg class="h-10 w-10 text-slate-600 transition-colors group-hover:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="15" x2="15.01" y1="13" y2="13"></line><line x1="18" x2="18.01" y1="11" y2="11"></line><rect width="20" height="12" x="2" y="6" rx="6"></rect></svg>
                </div>`
          }

          <div class="absolute inset-0 flex items-center justify-center bg-slate-950/50 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-lg transition-transform group-hover:scale-110">
              <svg class="h-5 w-5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </span>
          </div>

          <div class="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button data-fav-id="${game.id}" title="${isFav ? 'Remove favorite' : 'Add favorite'}" class="card-fav-btn flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 text-slate-300 backdrop-blur-sm transition-colors hover:bg-slate-800 hover:text-rose-500 cursor-pointer">
              <svg class="h-4 w-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
            ${
              game.isCustom
                ? `<button data-del-id="${game.id}" title="Delete custom game" class="card-del-btn flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 text-slate-400 backdrop-blur-sm transition-colors hover:bg-rose-950/80 hover:text-rose-400 cursor-pointer">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                   </button>`
                : ''
            }
          </div>
        </div>

        <div class="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
          <span>${game.category}</span>
          <span aria-hidden="true">·</span>
          <span class="font-mono tabular-nums text-amber-400">★ ${game.rating.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <span class="font-mono tabular-nums">${game.plays.toLocaleString()} plays</span>
        </div>

        <h3 class="font-display text-base font-bold text-white transition-colors group-hover:text-amber-400">${game.title}</h3>
        <p class="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">${game.description}</p>
      </div>

      <div class="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-500 font-mono">
        <span class="truncate max-w-[190px]">${game.controls}</span>
        <span class="text-amber-400/80 group-hover:text-amber-400 transition-colors">Play →</span>
      </div>
    `;

    card.onclick = (e) => {
      if (e.target.closest('.card-fav-btn') || e.target.closest('.card-del-btn')) {
        return;
      }
      openGame(game);
    };

    const favBtn = card.querySelector('.card-fav-btn');
    if (favBtn) {
      favBtn.onclick = (e) => {
        e.stopPropagation();
        favorites = toggleFavorite(game.id);
        renderFavBadge();
        renderGamesGrid();
      };
    }

    const delBtn = card.querySelector('.card-del-btn');
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${game.title}" from custom games?`)) {
          deleteCustomGame(game.id);
          games = getAllGames();
          renderHero();
          renderGamesGrid();
        }
      };
    }

    grid.appendChild(card);
  });
}

function renderCategoryBar() {
  const buttons = document.querySelectorAll('.cat-filter-btn');
  buttons.forEach((btn) => {
    const cat = btn.dataset.cat;
    const isActive = cat === currentCategory;
    if (isActive) {
      btn.className =
        'cat-filter-btn flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap bg-amber-500 text-slate-950 shadow-sm cursor-pointer';
    } else {
      btn.className =
        'cat-filter-btn flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200 cursor-pointer';
    }
  });

  const navLinks = document.querySelectorAll('.nav-cat-link');
  navLinks.forEach((link) => {
    const cat = link.dataset.cat;
    if (cat === currentCategory) {
      link.classList.add('text-amber-400', 'font-semibold');
      link.classList.remove('hover:text-slate-200');
    } else {
      link.classList.remove('text-amber-400', 'font-semibold');
      link.classList.add('hover:text-slate-200');
    }
  });
}

function renderFavBadge() {
  const badge = document.getElementById('fav-count-badge');
  const btnCount = document.getElementById('fav-btn-count');
  if (favorites.length > 0) {
    badge.textContent = `(${favorites.length})`;
    badge.classList.remove('hidden');
    btnCount.textContent = `(${favorites.length})`;
    btnCount.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    btnCount.classList.add('hidden');
  }
}

function setCategory(cat) {
  currentCategory = cat;
  renderCategoryBar();
  renderHero();
  renderRecent();
  renderGamesGrid();
}

// Player Overlay
function openGame(game) {
  activeGame = game;
  recordGamePlay(game.id);
  recentlyPlayedIds = getRecentlyPlayed();

  const playerModal = document.getElementById('player-modal');
  playerModal.classList.remove('hidden');

  document.getElementById('player-game-title').textContent = game.title;
  document.getElementById('player-game-cat').textContent = `· ${game.category}`;
  document.getElementById('player-bottom-title').textContent = game.title;
  document.getElementById('player-bottom-desc').textContent = game.description;
  document.getElementById('player-bottom-controls').textContent = game.controls;
  document.getElementById('player-stat-category').textContent = game.category;
  document.getElementById('player-stat-rating').textContent = `★ ${game.rating.toFixed(1)} / 5.0`;
  document.getElementById('player-stat-plays').textContent = game.plays.toLocaleString();

  updatePlayerFavBtn();
  loadIframe(game);
  document.getElementById('player-json-code').textContent = JSON.stringify(game, null, 2);
}

function closeGame() {
  activeGame = null;
  const playerModal = document.getElementById('player-modal');
  playerModal.classList.add('hidden');
  document.getElementById('iframe-viewport').innerHTML = '';
  renderRecent();
}

function loadIframe(game) {
  const viewport = document.getElementById('iframe-viewport');
  viewport.innerHTML = '';

  const { src, srcdoc, title } = extractIframeAttributes(game.iframe);
  const iframe = document.createElement('iframe');
  iframe.className = 'h-full w-full border-0';
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.sandbox =
    'allow-scripts allow-same-origin allow-forms allow-popups';
  iframe.allowFullscreen = true;
  iframe.title = title || game.title;

  if (srcdoc) {
    iframe.srcdoc = srcdoc;
  } else if (src) {
    iframe.src = src;
  } else {
    viewport.innerHTML = game.iframe;
    return;
  }

  viewport.appendChild(iframe);
}

function updatePlayerFavBtn() {
  if (!activeGame) return;
  const isFav = favorites.includes(activeGame.id);
  const icon = document.getElementById('player-fav-icon');
  const text = document.getElementById('player-fav-text');

  if (isFav) {
    icon.classList.add('fill-rose-500', 'text-rose-500');
    text.textContent = 'Favorited';
  } else {
    icon.classList.remove('fill-rose-500', 'text-rose-500');
    text.textContent = 'Favorite';
  }
}

// Modals
function openAddModal() {
  document.getElementById('add-game-modal').classList.remove('hidden');
}

function closeAddModal() {
  document.getElementById('add-game-modal').classList.add('hidden');
  document.getElementById('add-game-form').reset();
}

function openCloakModal() {
  document.getElementById('cloak-modal').classList.remove('hidden');
}

function closeCloakModal() {
  document.getElementById('cloak-modal').classList.add('hidden');
}

function setupCloakPresets() {
  const list = document.getElementById('cloak-presets-list');
  list.innerHTML = '';

  CLOAK_PRESETS.forEach((p) => {
    const isSelected = activeCloak === p.name;
    const btn = document.createElement('button');
    btn.className = `flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
      isSelected
        ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
    }`;
    btn.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="${p.icon}" alt="${p.name}" class="h-5 w-5 rounded object-contain" onerror="this.style.display='none'" />
        <div>
          <div class="text-sm font-semibold text-white">${p.name}</div>
          <div class="text-xs text-slate-400 truncate max-w-[240px]">${p.title}</div>
        </div>
      </div>
      ${
        isSelected
          ? '<svg class="h-4 w-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : ''
      }
    `;
    btn.onclick = () => {
      document.title = p.title;
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = p.icon;
      activeCloak = p.name;
      setupCloakPresets();
    };
    list.appendChild(btn);
  });
}

function resetCloak() {
  document.title = 'Unblocked Arcade - Free Playable Web Games';
  const link = document.querySelector("link[rel*='icon']");
  if (link) {
    link.href = '/favicon.ico';
  }
  activeCloak = null;
  setupCloakPresets();
}

// JSON Data Inspector Modal
function openJsonModal() {
  const modal = document.getElementById('json-modal');
  modal.classList.remove('hidden');

  const picker = document.getElementById('json-game-picker');
  picker.innerHTML = `<option value="all">Full Database (${games.length} games)</option>`;
  games.forEach((g) => {
    picker.innerHTML += `<option value="${g.id}">${g.title}</option>`;
  });

  updateJsonDisplay('all');
}

function closeJsonModal() {
  document.getElementById('json-modal').classList.add('hidden');
}

function updateJsonDisplay(id) {
  const codeEl = document.getElementById('json-code-display');
  const data = id === 'all' ? games : games.find((g) => g.id === id) || games;
  codeEl.textContent = JSON.stringify(data, null, 2);
}

// Event Listeners
function setupEventListeners() {
  // Brand click -> All category
  document.getElementById('nav-brand-btn').onclick = () => setCategory('All');

  // Category navigation buttons
  document.querySelectorAll('.cat-filter-btn, .nav-cat-link').forEach((btn) => {
    btn.onclick = () => setCategory(btn.dataset.cat);
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    if (searchQuery.trim()) {
      searchClearBtn.classList.remove('hidden');
    } else {
      searchClearBtn.classList.add('hidden');
    }
    renderHero();
    renderRecent();
    renderGamesGrid();
  };

  searchClearBtn.onclick = () => {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.classList.add('hidden');
    renderHero();
    renderRecent();
    renderGamesGrid();
  };

  document.getElementById('clear-filters-btn').onclick = () => {
    searchInput.value = '';
    searchQuery = '';
    currentCategory = 'All';
    searchClearBtn.classList.add('hidden');
    renderCategoryBar();
    renderHero();
    renderRecent();
    renderGamesGrid();
  };

  // Sort select
  document.getElementById('sort-select').onchange = (e) => {
    sortBy = e.target.value;
    renderGamesGrid();
  };

  // Player controls
  document.getElementById('close-player-btn').onclick = closeGame;
  document.getElementById('player-reload-btn').onclick = () => {
    if (activeGame) loadIframe(activeGame);
  };

  document.getElementById('player-theater-btn').onclick = () => {
    isTheater = !isTheater;
    const box = document.getElementById('player-container-box');
    const text = document.getElementById('player-theater-text');
    if (isTheater) {
      box.className = 'mx-auto max-w-7xl transition-all duration-300';
      text.textContent = 'Default';
    } else {
      box.className = 'mx-auto max-w-4xl transition-all duration-300';
      text.textContent = 'Theater';
    }
  };

  document.getElementById('player-fullscreen-btn').onclick = () => {
    const vp = document.getElementById('iframe-viewport');
    if (!document.fullscreenElement) {
      vp.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  document.getElementById('player-fav-btn').onclick = () => {
    if (!activeGame) return;
    favorites = toggleFavorite(activeGame.id);
    updatePlayerFavBtn();
    renderFavBadge();
    renderGamesGrid();
  };

  document.getElementById('player-cloak-btn').onclick = openCloakModal;

  document.getElementById('player-json-btn').onclick = () => {
    const drawer = document.getElementById('player-json-drawer');
    drawer.classList.toggle('hidden');
  };

  document.getElementById('player-copy-json-btn').onclick = () => {
    if (!activeGame) return;
    navigator.clipboard.writeText(JSON.stringify(activeGame, null, 2));
    const btn = document.getElementById('player-copy-json-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy JSON'), 2000);
  };

  // Add Game Modal triggers
  document.getElementById('open-add-btn').onclick = openAddModal;
  document.getElementById('footer-add-btn').onclick = openAddModal;
  document.getElementById('close-add-modal-btn').onclick = closeAddModal;
  document.getElementById('cancel-add-btn').onclick = closeAddModal;

  document.getElementById('add-game-form').onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('add-title').value.trim();
    const category = document.getElementById('add-category').value;
    const controls = document.getElementById('add-controls').value.trim() || 'Keyboard & Mouse';
    const accentColor = document.getElementById('add-color').value;
    const description = document.getElementById('add-desc').value.trim() || 'Custom user game.';
    let iframeRaw = document.getElementById('add-iframe').value.trim();

    if (iframeRaw.startsWith('http://') || iframeRaw.startsWith('https://')) {
      iframeRaw = `<iframe src="${iframeRaw}" title="${title}" width="100%" height="100%" frameborder="0" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
    } else if (!iframeRaw.includes('<iframe') && iframeRaw.includes('<html')) {
      const escaped = iframeRaw.replace(/"/g, '&quot;');
      iframeRaw = `<iframe srcdoc="${escaped}" title="${title}" width="100%" height="100%" frameborder="0" allowfullscreen sandbox="allow-scripts allow-same-origin"></iframe>`;
    }

    const saved = saveCustomGame({
      title,
      category,
      controls,
      accentColor,
      description,
      iframe: iframeRaw,
    });

    games = getAllGames();
    closeAddModal();
    renderHero();
    renderGamesGrid();
    openGame(saved);
  };

  // Cloak Modal triggers
  document.getElementById('open-cloak-btn').onclick = openCloakModal;
  document.getElementById('footer-cloak-btn').onclick = openCloakModal;
  document.getElementById('close-cloak-modal-btn').onclick = closeCloakModal;
  document.getElementById('done-cloak-btn').onclick = closeCloakModal;
  document.getElementById('reset-cloak-btn').onclick = resetCloak;

  // JSON Modal triggers
  document.getElementById('open-json-btn').onclick = openJsonModal;
  document.getElementById('footer-json-btn').onclick = openJsonModal;
  document.getElementById('close-json-modal-btn').onclick = closeJsonModal;

  document.getElementById('json-game-picker').onchange = (e) => {
    updateJsonDisplay(e.target.value);
  };

  document.getElementById('copy-json-btn').onclick = () => {
    const text = document.getElementById('json-code-display').textContent;
    navigator.clipboard.writeText(text);
    const label = document.getElementById('copy-json-text');
    label.textContent = 'Copied!';
    setTimeout(() => (label.textContent = 'Copy'), 2000);
  };

  document.getElementById('download-json-btn').onclick = () => {
    const text = document.getElementById('json-code-display').textContent;
    const picker = document.getElementById('json-game-picker');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = picker.value === 'all' ? 'games.json' : `${picker.value}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('player-modal').classList.contains('hidden')) {
        closeGame();
      } else if (!document.getElementById('add-game-modal').classList.contains('hidden')) {
        closeAddModal();
      } else if (!document.getElementById('cloak-modal').classList.contains('hidden')) {
        closeCloakModal();
      } else if (!document.getElementById('json-modal').classList.contains('hidden')) {
        closeJsonModal();
      }
    }
  });
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
