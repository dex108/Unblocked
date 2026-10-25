/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import defaultGames from './data/games.json';

const CUSTOM_GAMES_KEY = 'unblocked_custom_games';
const FAVORITES_KEY = 'unblocked_favorites';
const RECENTLY_PLAYED_KEY = 'unblocked_recently_played';

export function getAllGames() {
  let custom = [];
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_KEY);
    if (raw) {
      custom = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse custom games:', e);
  }
  return [...defaultGames, ...custom];
}

export function saveCustomGame(game) {
  const newGame = {
    ...game,
    id: 'custom-' + Date.now(),
    rating: 5.0,
    plays: 1,
    isCustom: true,
    dateAdded: new Date().toISOString(),
  };

  const existing = getCustomGames();
  const updated = [newGame, ...existing];
  localStorage.setItem(CUSTOM_GAMES_KEY, JSON.stringify(updated));
  return newGame;
}

export function deleteCustomGame(id) {
  const existing = getCustomGames();
  const updated = existing.filter((g) => g.id !== id);
  localStorage.setItem(CUSTOM_GAMES_KEY, JSON.stringify(updated));
}

export function getCustomGames() {
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(gameId) {
  const favs = getFavorites();
  const next = favs.includes(gameId)
    ? favs.filter((id) => id !== gameId)
    : [...favs, gameId];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export function getRecentlyPlayed() {
  try {
    const raw = localStorage.getItem(RECENTLY_PLAYED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordGamePlay(gameId) {
  try {
    const recent = getRecentlyPlayed().filter((id) => id !== gameId);
    recent.unshift(gameId);
    localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(recent.slice(0, 8)));
  } catch (e) {
    console.error('Failed to update recent plays', e);
  }
}

export function extractIframeAttributes(rawIframe) {
  if (rawIframe.startsWith('http://') || rawIframe.startsWith('https://')) {
    return { src: rawIframe, title: 'Embedded Game' };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawIframe, 'text/html');
  const iframeEl = doc.querySelector('iframe');

  if (iframeEl) {
    const srcdoc = iframeEl.getAttribute('srcdoc') || undefined;
    const src = iframeEl.getAttribute('src') || undefined;
    const title = iframeEl.getAttribute('title') || 'Game Frame';
    return { src, srcdoc, title };
  }

  return { srcdoc: rawIframe, title: 'Game Frame' };
}
