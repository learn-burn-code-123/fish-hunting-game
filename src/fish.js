import * as THREE from 'three';
import { WORLD } from './scene.js';

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);

// Fish type table: [color/material descriptor, points, sizeScale, speed]
const FISH_TYPES = [
  { id: 'red', color: 0xff4d4d, points: 1, size: 0.8, speed: 1.4, weight: 18 },
  { id: 'yellow', color: 0xffd84d, points: 2, size: 0.9, speed: 2.0, weight: 16 },
  { id: 'pink', color: 0xff7ab8, points: 3, size: 1.05, speed: 2.0, weight: 14 },
  { id: 'rainbow', color: 'rainbow', points: 5, size: 1.05, speed: 3.0, weight: 8 },
  { id: 'orange', color: 0xff9a3c, points: 1, size: 0.8, speed: 1.4, weight: 18 },
  { id: 'blue', color: 0x4dc3ff, points: 2, size: 0.85, speed: 2.0, weight: 16 },
  { id: 'gold', color: 0xffe24d, points: 10, size: 0.85, speed: 4.5, weight: 1 } // ~1/91
];

const PARTICLE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.85,
  depthWrite: false
});

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pickFishType() {
  // Weighted random
  let total = 0;
  for (const t of FISH_TYPES) total += t.weight;
  let r = Math.random() * total;
  for (const t of FISH_TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return FISH_TYPES[0];
}

function randomSpawnFar(fromPosition, minDist = 18) {
  // Try a handful of times to find a point far from the shark
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Vector3(
      rand(-WORLD.halfX + 4, WORLD.halfX - 4),
      rand(WORLD.floorY + 4, WORLD.surfaceY - 4),
      rand(-WORLD.halfZ + 4, WORLD.halfZ - 4)
    );
    if (!fromPosition || p.distanceTo(fromPosition) >= minDist) return p;
  }
  return new THREE.Vector3(
    rand(-WORLD.halfX + 4, WORLD.halfX - 4),
    rand(WORLD.floorY + 4, WORLD.surfaceY - 4),
    rand(-WORLD.halfZ + 4, WORLD.halfZ - 4)
  );
}

function buildFishMesh(type) {
  const group = new THREE.Group();

  if (type.color === 'rainbow') {
    // Multi-segment rainbow body
    const colors = [0xff4d4d, 0xffd84d, 0x4dff6a, 0x4dc3ff, 0xa04dff];
    for (let i = 0; i < colors.length; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: colors[i],
        flatShading: true
      });
      const seg = new THREE.Mesh(SHARED_BOX, mat);
      seg.scale.set(0.55, 0.55, 0.35);
      seg.position.z = (i - (colors.length - 1) / 2) * 0.34;
      group.add(seg);
    }
    // Tail
    const tailMat = new THREE.MeshLambertMaterial({
      color: 0xa04dff,
      flatShading: true
    });
    const tail = new THREE.Mesh(SHARED_BOX, tailMat);
    tail.scale.set(0.18, 0.65, 0.45);
    tail.position.z = -0.95;
    group.add(tail);
  } else {
    const mat = new THREE.MeshLambertMaterial({
      color: type.color,
      flatShading: true,
      emissive: type.id === 'gold' ? 0x553300 : 0x000000,
      emissiveIntensity: type.id === 'gold' ? 0.6 : 0
    });
    // Body
    const body = new THREE.Mesh(SHARED_BOX, mat);
    body.scale.set(0.65, 0.65, 1.0);
    group.add(body);
    // Tail (smaller, behind)
    const tailMat = mat.clone();
    tailMat.color = mat.color.clone().multiplyScalar(0.85);
    const tail = new THREE.Mesh(SHARED_BOX, tailMat);
    tail.scale.set(0.2, 0.55, 0.4);
    tail.position.z = -0.7;
    group.add(tail);
    // Eye
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
    const eyeR = new THREE.Mesh(SHARED_BOX, eyeMat);
    eyeR.scale.set(0.12, 0.12, 0.12);
    eyeR.position.set(0.34, 0.1, 0.4);
    group.add(eyeR);
    const eyeL = new THREE.Mesh(SHARED_BOX, eyeMat);
    eyeL.scale.set(0.12, 0.12, 0.12);
    eyeL.position.set(-0.34, 0.1, 0.4);
    group.add(eyeL);
  }

  group.scale.multiplyScalar(type.size);
  return group;
}

class Fish {
  constructor(scene, sharkPosition) {
    this.type = pickFishType();
    this.mesh = buildFishMesh(this.type);
    const spawn = randomSpawnFar(sharkPosition, 14);
    this.mesh.position.copy(spawn);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
    this.target = new THREE.Vector3();
    this.nextTargetIn = 0;
    this._tmp = new THREE.Vector3();
    this._box = new THREE.Box3();
    this.pickNewTarget();
  }

  pickNewTarget() {
    this.target.set(
      rand(-WORLD.halfX + 5, WORLD.halfX - 5),
      rand(WORLD.floorY + 4, WORLD.surfaceY - 4),
      rand(-WORLD.halfZ + 5, WORLD.halfZ - 5)
    );
    this.nextTargetIn = rand(3, 6);
  }

  update(dt) {
    this.nextTargetIn -= dt;
    if (this.nextTargetIn <= 0) this.pickNewTarget();

    // Steer toward target
    this._tmp.subVectors(this.target, this.mesh.position);
    const dist = this._tmp.length();
    if (dist > 0.001) this._tmp.divideScalar(dist);
    // Lerp velocity toward desired
    const desiredSpeed = this.type.speed;
    this._tmp.multiplyScalar(desiredSpeed);
    const lerpAmt = 1 - Math.exp(-2 * dt);
    this.velocity.lerp(this._tmp, lerpAmt);

    this.mesh.position.addScaledVector(this.velocity, dt);

    // Soft clamp inside world
    const m = 3;
    if (this.mesh.position.x < -WORLD.halfX + m) {
      this.mesh.position.x = -WORLD.halfX + m;
      this.velocity.x = Math.abs(this.velocity.x);
    } else if (this.mesh.position.x > WORLD.halfX - m) {
      this.mesh.position.x = WORLD.halfX - m;
      this.velocity.x = -Math.abs(this.velocity.x);
    }
    if (this.mesh.position.z < -WORLD.halfZ + m) {
      this.mesh.position.z = -WORLD.halfZ + m;
      this.velocity.z = Math.abs(this.velocity.z);
    } else if (this.mesh.position.z > WORLD.halfZ - m) {
      this.mesh.position.z = WORLD.halfZ - m;
      this.velocity.z = -Math.abs(this.velocity.z);
    }
    if (this.mesh.position.y < WORLD.floorY + 2) {
      this.mesh.position.y = WORLD.floorY + 2;
      this.velocity.y = Math.abs(this.velocity.y);
    } else if (this.mesh.position.y > WORLD.surfaceY - 2) {
      this.mesh.position.y = WORLD.surfaceY - 2;
      this.velocity.y = -Math.abs(this.velocity.y);
    }

    // Face direction of travel
    if (this.velocity.lengthSq() > 0.01) {
      const lookAt = this._tmp
        .copy(this.mesh.position)
        .add(this.velocity);
      this.mesh.lookAt(lookAt);
    }
  }

  getBox(out) {
    return out.setFromObject(this.mesh);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if (obj.material && obj.material !== PARTICLE_MAT) {
        // materials are mostly cloned per-fish; safe to dispose.
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  }
}

const fishList = [];
const particles = []; // { mesh, vel, life, totalLife }
const pendingRespawns = []; // { time, scene }
let elapsed = 0;
const _sharkBox = new THREE.Box3();
const _fishBox = new THREE.Box3();

export function spawnFishSwarm(scene, count, sharkPosition) {
  for (let i = 0; i < count; i++) {
    fishList.push(new Fish(scene, sharkPosition));
  }
}

export function updateFish(dt, shark) {
  elapsed += dt;
  for (const f of fishList) f.update(dt);
  // Respawn timers
  for (let i = pendingRespawns.length - 1; i >= 0; i--) {
    pendingRespawns[i].time -= dt;
    if (pendingRespawns[i].time <= 0) {
      const r = pendingRespawns.splice(i, 1)[0];
      fishList.push(new Fish(r.scene, shark.position));
    }
  }
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.material.dispose?.();
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(1 - 0.6 * dt);
    p.vel.y += 1.0 * dt; // bubbles rise
    const t = p.life / p.totalLife;
    p.mesh.material.opacity = 0.85 * t;
    p.mesh.scale.setScalar(0.25 + (1 - t) * 0.15);
  }
}

function spawnBubbleBurst(scene, position) {
  const count = 6 + Math.floor(Math.random() * 5); // 6..10
  for (let i = 0; i < count; i++) {
    const mat = PARTICLE_MAT.clone();
    const m = new THREE.Mesh(SHARED_BOX, mat);
    m.scale.setScalar(0.25);
    m.position.copy(position);
    scene.add(m);
    const vel = new THREE.Vector3(
      rand(-2, 2),
      rand(0.5, 3),
      rand(-2, 2)
    );
    particles.push({ mesh: m, vel, life: 0.9, totalLife: 0.9 });
  }
}

// Generic eat detection for any "eater" with a `mesh` (or `group`) reference.
// Returns the eaten fish info ({ type, points, position }) or null.
export function checkEats(eater, scene, expand = 0.5) {
  const mesh = eater.mesh ?? eater;
  _sharkBox.setFromObject(mesh).expandByScalar(expand);

  for (let i = fishList.length - 1; i >= 0; i--) {
    const f = fishList[i];
    f.getBox(_fishBox);
    if (_sharkBox.intersectsBox(_fishBox)) {
      const screenPos = f.mesh.position.clone();
      const eaten = {
        type: f.type.id,
        points: f.type.points,
        position: screenPos
      };
      spawnBubbleBurst(scene, screenPos);
      f.dispose(scene);
      fishList.splice(i, 1);
      pendingRespawns.push({ time: rand(1.0, 2.0), scene });
      return eaten;
    }
  }
  return null;
}

// Find the nearest fish to a given position (for the rival's hunting AI).
export function getNearestFish(position, maxDistance = Infinity) {
  let best = null;
  let bestDistSq = maxDistance * maxDistance;
  for (const f of fishList) {
    const dSq = position.distanceToSquared(f.mesh.position);
    if (dSq < bestDistSq) {
      best = f;
      bestDistSq = dSq;
    }
  }
  return best;
}

export function getFishCount() {
  return fishList.length;
}

export function resetFish(scene) {
  for (const f of fishList) f.dispose(scene);
  fishList.length = 0;
  pendingRespawns.length = 0;
}
