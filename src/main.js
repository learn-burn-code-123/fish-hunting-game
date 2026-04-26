import * as THREE from 'three';
import { initScene } from './scene.js';
import { createShark } from './shark.js';
import {
  spawnFishSwarm,
  updateFish,
  checkEats,
  getFishCount,
  resetFish
} from './fish.js';
import { initWorld, updateWorld } from './world.js';
import { bindInput, getInput } from './input.js';
import {
  initHUD,
  showHUD,
  updateScore,
  setScoreOnly,
  resetBest
} from './hud.js';
import { unlockAudio, playChomp, playBump } from './audio.js';

const TARGET_FISH = 25;

const { scene, camera, renderer } = initScene();
const shark = createShark(scene);
initWorld(scene);
spawnFishSwarm(scene, TARGET_FISH, shark.position);
bindInput();

let score = 0;
let started = false;
let lastBumpAt = 0;

initHUD({
  renderer,
  camera,
  onReset: () => {
    score = 0;
    setScoreOnly(0);
    resetBest();
    resetFish(scene);
    spawnFishSwarm(scene, TARGET_FISH, shark.position);
  }
});

const playBtn = document.getElementById('play-btn');
const introEl = document.getElementById('intro');

function startGame() {
  if (started) return;
  started = true;
  unlockAudio();
  introEl.classList.add('hidden');
  showHUD();
}
playBtn.addEventListener('click', startGame);
// Also start on first key press
window.addEventListener(
  'keydown',
  () => {
    if (!started) startGame();
  },
  { once: false }
);

const clock = new THREE.Clock();

// Initial camera placement (so we don't snap on first frame)
camera.position.copy(shark.getCameraTarget());
camera.lookAt(shark.position);

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 20); // clamp for perf hiccups

  if (started) {
    shark.update(dt, getInput());

    if (shark.group.userData.bumped && performance.now() - lastBumpAt > 220) {
      lastBumpAt = performance.now();
      playBump();
    }

    updateFish(dt, shark);
    updateWorld(dt, scene);

    const eaten = checkEats(shark, scene);
    if (eaten) {
      score += eaten.points;
      shark.chomp();
      playChomp(eaten.points);
      updateScore(score, eaten);
    }

    // Top-up fish swarm in case any fish got disposed unexpectedly
    if (getFishCount() < TARGET_FISH - 5) {
      spawnFishSwarm(scene, TARGET_FISH - getFishCount(), shark.position);
    }
  } else {
    // Idle animation: still update the world so the intro looks alive
    updateWorld(dt, scene);
    updateFish(dt, shark);
  }

  // Camera follow (always)
  const target = shark.getCameraTarget();
  camera.position.lerp(target, started ? 0.12 : 0.05);
  camera.lookAt(shark.position);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
