// Unified keyboard + pointer input. Works on macOS, Windows, Linux, iOS,
// Android, and any device that fires PointerEvents (which is essentially
// every browser shipping today).

const state = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false
};

// Multiple key bindings per action so Space/Shift work, AND alternates work
// even when the OS or page intercepts those keys.
const KEY_MAP = {
  // Forward / back
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  // Strafe
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  // Up (rise)
  Space: 'up',
  KeyR: 'up',
  KeyE: 'up',
  // Down (dive)
  ShiftLeft: 'down',
  ShiftRight: 'down',
  KeyF: 'down',
  KeyQ: 'down'
};

// Keys we consume completely so they never trigger page scroll, button
// activation, etc. We register on `window` with capture: true so we beat
// element-level handlers (e.g. the reset button consuming Space → click).
const SWALLOW = new Set([
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
]);

function onKey(e, isDown) {
  if (SWALLOW.has(e.code)) e.preventDefault();
  const action = KEY_MAP[e.code];
  if (!action) return;
  state[action] = isDown;
}

function bindPointerButton(btn) {
  const action = btn.dataset.touch;
  if (!action) return;

  const press = (e) => {
    // Don't try to capture pointers that are already released.
    if (e.pointerId !== undefined && btn.setPointerCapture) {
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers throw if the pointer isn't active; safe to ignore.
      }
    }
    state[action] = true;
    btn.classList.add('active');
    e.preventDefault();
  };
  const release = (e) => {
    state[action] = false;
    btn.classList.remove('active');
    if (e && e.pointerId !== undefined && btn.releasePointerCapture) {
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Modern Pointer Events cover mouse + touch + pen on every supported
  // platform (incl. iOS Safari 13+).
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', (e) => {
    // If the user drags the pointer off the button, release the action so
    // they don't get "stuck on".
    if (e.buttons === 0) release(e);
  });

  // Belt-and-suspenders fallback for very old browsers that don't have
  // Pointer Events.
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });

  // Prevent accidental focus + keyboard activation of the button (which
  // would also fire on Space/Enter and could double-trigger the action).
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function detectTouchCapability() {
  const hasTouch =
    'ontouchstart' in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
  if (hasTouch) {
    document.documentElement.classList.add('has-touch');
  }
}

export function bindInput() {
  window.addEventListener('keydown', (e) => onKey(e, true), { capture: true });
  window.addEventListener('keyup', (e) => onKey(e, false), { capture: true });

  detectTouchCapability();
  document.querySelectorAll('.tbtn').forEach(bindPointerButton);

  // If the window loses focus or the page is hidden, drop all keys so the
  // shark doesn't keep sliding when the user tabs away.
  const clearAll = () => {
    for (const k of Object.keys(state)) state[k] = false;
    document.querySelectorAll('.tbtn.active').forEach((b) =>
      b.classList.remove('active')
    );
  };
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
  });
}

export function getInput() {
  return state;
}
