import * as THREE from 'three';
import { WORLD } from './scene.js';

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);

const SAND_MAT = new THREE.MeshLambertMaterial({ color: 0xe8d5a0, flatShading: true });
const SAND_MAT_DARK = new THREE.MeshLambertMaterial({ color: 0xc9b483, flatShading: true });
const SEAWEED_MAT = new THREE.MeshLambertMaterial({ color: 0x2d8c4a, flatShading: true });
const SEAWEED_MAT_2 = new THREE.MeshLambertMaterial({ color: 0x46a85b, flatShading: true });
const ROCK_MAT = new THREE.MeshLambertMaterial({ color: 0x666666, flatShading: true });
const ROCK_MAT_2 = new THREE.MeshLambertMaterial({ color: 0x808080, flatShading: true });

const CORAL_COLORS = [0xff7ab8, 0xff9a3c, 0xa04dff, 0xff4d4d, 0x4dc3ff];

const BUBBLE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
  depthWrite: false
});

const seaweedClumps = []; // { meshes: [...], basePhase, x, z }
const bubbleParticles = []; // { mesh, vy, life }

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function makeBlock(geometry, material, sx, sy, sz) {
  const m = new THREE.Mesh(geometry, material);
  m.scale.set(sx, sy, sz);
  return m;
}

function buildSandFloor(scene) {
  // A single large flat box for the floor (cheap), plus scattered "bumps" of
  // sand cubes for the blocky look.
  const floor = makeBlock(
    SHARED_BOX,
    SAND_MAT,
    WORLD.halfX * 2 + 4,
    1,
    WORLD.halfZ * 2 + 4
  );
  floor.position.set(0, WORLD.floorY - 0.5, 0);
  scene.add(floor);

  // Random sand bumps
  for (let i = 0; i < 80; i++) {
    const s = rand(0.8, 2.0);
    const bump = makeBlock(
      SHARED_BOX,
      Math.random() < 0.4 ? SAND_MAT_DARK : SAND_MAT,
      s,
      rand(0.4, 1.2),
      s
    );
    bump.position.set(
      rand(-WORLD.halfX, WORLD.halfX),
      WORLD.floorY + rand(0.1, 0.4),
      rand(-WORLD.halfZ, WORLD.halfZ)
    );
    scene.add(bump);
  }
}

function buildSeaweedClump(scene, x, z) {
  const count = randInt(2, 4);
  const meshes = [];
  for (let i = 0; i < count; i++) {
    const seg = makeBlock(
      SHARED_BOX,
      i % 2 === 0 ? SEAWEED_MAT : SEAWEED_MAT_2,
      0.5,
      1.0,
      0.5
    );
    seg.position.set(x, WORLD.floorY + 0.5 + i * 0.95, z);
    scene.add(seg);
    meshes.push(seg);
  }
  seaweedClumps.push({
    meshes,
    basePhase: rand(0, Math.PI * 2),
    x,
    z
  });
}

function buildCoralCluster(scene, x, z) {
  const baseColor = CORAL_COLORS[randInt(0, CORAL_COLORS.length - 1)];
  const mat = new THREE.MeshLambertMaterial({
    color: baseColor,
    flatShading: true
  });
  const stack = randInt(2, 4);
  for (let i = 0; i < stack; i++) {
    const s = rand(0.5, 1.0);
    const piece = makeBlock(SHARED_BOX, mat, s, rand(0.5, 1.0), s);
    piece.position.set(
      x + rand(-0.6, 0.6),
      WORLD.floorY + 0.4 + i * 0.7,
      z + rand(-0.6, 0.6)
    );
    scene.add(piece);
  }
  // a couple of bright tip cubes
  for (let i = 0; i < 2; i++) {
    const tip = makeBlock(SHARED_BOX, mat, 0.4, 0.4, 0.4);
    tip.position.set(
      x + rand(-0.8, 0.8),
      WORLD.floorY + 0.4 + stack * 0.7 + rand(0, 0.6),
      z + rand(-0.8, 0.8)
    );
    scene.add(tip);
  }
}

function buildRockCluster(scene, x, z) {
  const count = randInt(2, 5);
  for (let i = 0; i < count; i++) {
    const s = rand(0.7, 1.6);
    const rock = makeBlock(
      SHARED_BOX,
      i % 2 === 0 ? ROCK_MAT : ROCK_MAT_2,
      s,
      s * rand(0.6, 1.0),
      s
    );
    rock.position.set(
      x + rand(-1.2, 1.2),
      WORLD.floorY + s * 0.4,
      z + rand(-1.2, 1.2)
    );
    scene.add(rock);
  }
}

function buildDecorations(scene) {
  const total = 50;
  for (let i = 0; i < total; i++) {
    const x = rand(-WORLD.halfX + 4, WORLD.halfX - 4);
    const z = rand(-WORLD.halfZ + 4, WORLD.halfZ - 4);
    const r = Math.random();
    if (r < 0.45) buildSeaweedClump(scene, x, z);
    else if (r < 0.8) buildCoralCluster(scene, x, z);
    else buildRockCluster(scene, x, z);
  }
}

function spawnBubble(scene) {
  const s = rand(0.18, 0.45);
  const bubble = makeBlock(SHARED_BOX, BUBBLE_MAT, s, s, s);
  bubble.position.set(
    rand(-WORLD.halfX + 2, WORLD.halfX - 2),
    WORLD.floorY + rand(0.5, 2),
    rand(-WORLD.halfZ + 2, WORLD.halfZ - 2)
  );
  scene.add(bubble);
  bubbleParticles.push({
    mesh: bubble,
    vy: rand(1.5, 3.0),
    drift: rand(-0.3, 0.3)
  });
}

let bubbleSpawnTimer = 0;
const MAX_BUBBLES = 40;

let elapsed = 0;

export function initWorld(scene) {
  buildSandFloor(scene);
  buildDecorations(scene);

  // Pre-seed a handful of bubbles so the scene isn't empty at first.
  for (let i = 0; i < 12; i++) spawnBubble(scene);
}

export function updateWorld(dt, scene) {
  elapsed += dt;

  // Sway seaweed
  for (const clump of seaweedClumps) {
    for (let i = 0; i < clump.meshes.length; i++) {
      const m = clump.meshes[i];
      const sway = Math.sin(elapsed * 1.5 + clump.basePhase + i * 0.4) * 0.08;
      m.rotation.x = sway * (i + 1) * 0.5;
      m.rotation.z = Math.sin(elapsed * 1.2 + clump.basePhase) * 0.06 * (i + 1) * 0.4;
    }
  }

  // Spawn bubbles
  bubbleSpawnTimer -= dt;
  if (bubbleSpawnTimer <= 0 && bubbleParticles.length < MAX_BUBBLES) {
    spawnBubble(scene);
    bubbleSpawnTimer = 0.3;
  }

  // Update bubbles
  for (let i = bubbleParticles.length - 1; i >= 0; i--) {
    const b = bubbleParticles[i];
    b.mesh.position.y += b.vy * dt;
    b.mesh.position.x += Math.sin(elapsed * 2 + i) * b.drift * dt;
    if (b.mesh.position.y > WORLD.surfaceY - 1) {
      scene.remove(b.mesh);
      if (b.mesh.material !== BUBBLE_MAT) b.mesh.material.dispose?.();
      bubbleParticles.splice(i, 1);
    } else if (b.mesh.position.y > WORLD.surfaceY - 6) {
      // Clone the shared material once so we can fade this bubble individually.
      if (b.mesh.material === BUBBLE_MAT) {
        b.mesh.material = BUBBLE_MAT.clone();
      }
      const t = (WORLD.surfaceY - b.mesh.position.y) / 6;
      b.mesh.material.opacity = 0.5 * Math.max(0, t);
    }
  }
}
