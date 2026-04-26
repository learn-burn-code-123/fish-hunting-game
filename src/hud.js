import * as THREE from 'three';

const STORAGE_KEY = 'blocky-shark-ocean.best';

let scoreEl, bestEl, rivalEl, popupsEl, resetBtn;
let renderer, camera;
let bestScore = 0;

function readBest() {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeBest(v) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // ignore
  }
}

export function initHUD({ renderer: r, camera: c, onReset }) {
  renderer = r;
  camera = c;
  scoreEl = document.getElementById('score-value');
  bestEl = document.getElementById('best-value');
  rivalEl = document.getElementById('rival-value');
  popupsEl = document.getElementById('popups');
  resetBtn = document.getElementById('reset-btn');

  bestScore = readBest();
  bestEl.textContent = String(bestScore);
  scoreEl.textContent = '0';
  if (rivalEl) rivalEl.textContent = '0';

  resetBtn.addEventListener('click', () => {
    if (typeof onReset === 'function') onReset();
  });
}

export function showHUD() {
  document.getElementById('hud').classList.remove('hidden');
}

export function hideHUD() {
  document.getElementById('hud').classList.add('hidden');
}

export function updateScore(score, eaten) {
  scoreEl.textContent = String(score);
  if (score > bestScore) {
    bestScore = score;
    bestEl.textContent = String(bestScore);
    writeBest(bestScore);
  }
  if (eaten) showFloatingPopup(eaten);
}

export function setScoreOnly(score) {
  scoreEl.textContent = String(score);
}

export function updateRivalScore(rivalScore, eaten) {
  if (rivalEl) rivalEl.textContent = String(rivalScore);
  if (eaten) showFloatingPopup(eaten, { rival: true });
}

export function setRivalScoreOnly(rivalScore) {
  if (rivalEl) rivalEl.textContent = String(rivalScore);
}

const _v = new THREE.Vector3();

function worldToScreen(pos) {
  _v.copy(pos).project(camera);
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  return {
    x: (_v.x * 0.5 + 0.5) * w,
    y: (-_v.y * 0.5 + 0.5) * h,
    inFront: _v.z < 1
  };
}

const POINT_COLORS = {
  red: '#ff4d4d',
  yellow: '#ffd84d',
  pink: '#ff7ab8',
  rainbow: '#ffffff',
  orange: '#ff9a3c',
  blue: '#4dc3ff',
  gold: '#ffe24d'
};

function showFloatingPopup(eaten, opts = {}) {
  if (!eaten || !eaten.position) return;
  const screen = worldToScreen(eaten.position);
  if (!screen.inFront) return;

  const el = document.createElement('div');
  el.className = opts.rival ? 'popup popup-rival' : 'popup';
  el.textContent = `+${eaten.points}`;
  el.style.left = `${screen.x}px`;
  el.style.top = `${screen.y}px`;
  el.style.color = opts.rival
    ? '#c4b6ff'
    : POINT_COLORS[eaten.type] || 'white';
  if (eaten.type === 'gold') {
    el.style.fontSize = opts.rival ? '2rem' : '3rem';
    el.textContent = `${opts.rival ? '−' : '+'}${eaten.points} ⭐`;
  } else if (eaten.type === 'rainbow') {
    el.textContent = `${opts.rival ? '−' : '+'}${eaten.points} 🌈`;
  } else if (opts.rival) {
    // For the player it's a "+", for the rival show a small minus icon to
    // make it clear that fish was lost.
    el.textContent = `−${eaten.points}`;
    el.style.fontSize = '1.4rem';
  }
  popupsEl.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function getBestScore() {
  return bestScore;
}

export function resetBest() {
  bestScore = 0;
  bestEl.textContent = '0';
  writeBest(0);
}
