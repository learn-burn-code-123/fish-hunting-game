// Unified keyboard + touch input. We keep boolean flags for each direction.

const state = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false
};

const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'up',
  ShiftLeft: 'down',
  ShiftRight: 'down'
};

function onKey(e, isDown) {
  const action = KEY_MAP[e.code];
  if (!action) return;
  if (action === 'up' || action === 'down') {
    e.preventDefault();
  }
  state[action] = isDown;
}

function bindTouchButton(btn) {
  const action = btn.dataset.touch;
  if (!action) return;

  const press = (e) => {
    e.preventDefault();
    state[action] = true;
    btn.classList.add('active');
  };
  const release = (e) => {
    e.preventDefault();
    state[action] = false;
    btn.classList.remove('active');
  };

  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
}

export function bindInput() {
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  // Touch buttons
  document.querySelectorAll('.tbtn').forEach(bindTouchButton);

  // Lose focus on tab switch -> clear input so the shark doesn't keep moving
  window.addEventListener('blur', () => {
    for (const k of Object.keys(state)) state[k] = false;
  });
}

export function getInput() {
  return state;
}
