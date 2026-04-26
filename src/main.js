import * as THREE from 'three';
import { initScene } from './scene.js';
import { createShark, createRivalShark } from './shark.js';
import {
  spawnFishSwarm,
  updateFish,
  checkEats,
  getNearestFish,
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
  updateRivalScore,
  setRivalScoreOnly,
  resetBest
} from './hud.js';
import { unlockAudio, playChomp, playBump } from './audio.js';

const TARGET_FISH = 25;

const { scene, camera, renderer } = initScene();
const shark = createShark(scene);
const rival = createRivalShark(scene);
initWorld(scene);
spawnFishSwarm(scene, TARGET_FISH, shark.position);
bindInput();

let score = 0;
let rivalScore = 0;
let started = false;
let lastBumpAt = 0;

initHUD({
  renderer,
  camera,
  onReset: () => {
    score = 0;
    rivalScore = 0;
    setScoreOnly(0);
    setRivalScoreOnly(0);
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
window.addEventListener('keydown', () => {
  if (!started) startGame();
});

const clock = new THREE.Clock();

camera.position.copy(shark.getCameraTarget());
camera.lookAt(shark.position);

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 20);

  if (started) {
    shark.update(dt, getInput());

    if (shark.group.userData.bumped && performance.now() - lastBumpAt > 220) {
      lastBumpAt = performance.now();
      playBump();
    }

    // Rival hunts the fish nearest to it. Only see fish within a generous
    // sensing radius so it occasionally idles/wanders rather than constantly
    // tractor-beaming the entire ocean.
    const prey = getNearestFish(rival.position, 60);
    rival.update(dt, prey);

    updateFish(dt, shark);
    updateWorld(dt, scene);

    // Player eats first (if both happen to overlap a fish on the same frame
    // the kid wins — they're the protagonist).
    const eaten = checkEats(shark, scene, 0.5);
    if (eaten) {
      score += eaten.points;
      shark.chomp();
      playChomp(eaten.points);
      updateScore(score, eaten);
    }

    const rivalAte = checkEats(rival, scene, 0.3);
    if (rivalAte) {
      rivalScore += rivalAte.points;
      rival.chomp();
      updateRivalScore(rivalScore, rivalAte);
    }

    if (getFishCount() < TARGET_FISH - 5) {
      spawnFishSwarm(scene, TARGET_FISH - getFishCount(), shark.position);
    }
  } else {
    // Idle animation: still update the world so the intro looks alive.
    updateWorld(dt, scene);
    updateFish(dt, shark);
    rival.update(dt, getNearestFish(rival.position, 60));
  }

  // Camera follow (always)
  const target = shark.getCameraTarget();
  camera.position.lerp(target, started ? 0.12 : 0.05);
  camera.lookAt(shark.position);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
