import * as THREE from 'three';
import { WORLD } from './scene.js';

const PLAYER_SPEED = 7; // units / sec
const RIVAL_SPEED = 2.8; // very slow per spec
const ACCEL = 6; // velocity lerp factor
const TURN_LERP = 6; // rotation lerp factor (player)
const RIVAL_TURN_LERP = 3.5; // gentler

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);
const MAT_BLACK = new THREE.MeshLambertMaterial({ color: 0x101010, flatShading: true });

const PLAYER_PALETTE = {
  top: 0xb8c0c8,
  belly: 0xf2f2f2,
  fin: 0x707880,
  mouth: 0xff9aa8,
  scale: 1.0
};

const RIVAL_PALETTE = {
  // Friendly purple/lavender so kids can tell the two apart at a glance
  top: 0x9c8cd4,
  belly: 0xe8dcff,
  fin: 0x6a5fa8,
  mouth: 0xff7ab8,
  scale: 0.85
};

function block(material, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(SHARED_BOX, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

// Build a blocky shark mesh. Returns { group, body, mouth } so callers can
// animate the body bob and mouth chomp independently.
function buildSharkMesh(palette) {
  const TOP = new THREE.MeshLambertMaterial({ color: palette.top, flatShading: true });
  const BELLY = new THREE.MeshLambertMaterial({ color: palette.belly, flatShading: true });
  const FIN = new THREE.MeshLambertMaterial({ color: palette.fin, flatShading: true });
  const MOUTH_MAT = new THREE.MeshLambertMaterial({
    color: palette.mouth,
    flatShading: true
  });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // Main body (long block) — top + belly
  body.add(block(TOP, 1.2, 0.9, 3.0, 0, 0.15, 0));
  body.add(block(BELLY, 1.21, 0.4, 2.8, 0, -0.3, 0));

  // Head
  body.add(block(TOP, 1.3, 1.0, 1.0, 0, 0.15, 1.6));
  body.add(block(BELLY, 1.31, 0.4, 0.95, 0, -0.3, 1.6));

  // Mouth — pink block scaled briefly when chomping
  const mouth = block(MOUTH_MAT, 0.9, 0.18, 0.2, 0, -0.18, 2.15);
  mouth.userData.baseScaleY = 0.18;
  body.add(mouth);

  // Eyes
  body.add(block(MAT_BLACK, 0.18, 0.18, 0.18, 0.55, 0.35, 1.95));
  body.add(block(MAT_BLACK, 0.18, 0.18, 0.18, -0.55, 0.35, 1.95));

  // Tail
  body.add(block(TOP, 0.8, 0.8, 0.8, 0, 0.2, -1.8));
  body.add(block(FIN, 0.4, 1.3, 0.6, 0, 0.6, -2.3)); // upper tail fin
  body.add(block(FIN, 0.4, 0.6, 0.5, 0, -0.2, -2.2)); // lower tail fin

  // Side fins
  body.add(block(FIN, 1.4, 0.15, 0.6, 0, -0.05, 0.4));
  // Top fin
  body.add(block(FIN, 0.18, 0.9, 0.7, 0, 0.95, 0.1));

  group.scale.setScalar(palette.scale ?? 1);
  return { group, body, mouth };
}

// Apply soft world bounds and report whether the shark bumped a wall.
function clampToWorld(group, velocity) {
  const margin = 1.5;
  const minX = -WORLD.halfX + margin;
  const maxX = WORLD.halfX - margin;
  const minZ = -WORLD.halfZ + margin;
  const maxZ = WORLD.halfZ - margin;
  const minY = WORLD.floorY + 2.5;
  const maxY = WORLD.surfaceY - 2.5;

  let bumped = false;
  if (group.position.x < minX) {
    group.position.x = minX;
    velocity.x = Math.max(velocity.x, 2);
    bumped = true;
  } else if (group.position.x > maxX) {
    group.position.x = maxX;
    velocity.x = Math.min(velocity.x, -2);
    bumped = true;
  }
  if (group.position.z < minZ) {
    group.position.z = minZ;
    velocity.z = Math.max(velocity.z, 2);
    bumped = true;
  } else if (group.position.z > maxZ) {
    group.position.z = maxZ;
    velocity.z = Math.min(velocity.z, -2);
    bumped = true;
  }
  if (group.position.y < minY) {
    group.position.y = minY;
    velocity.y = Math.max(velocity.y, 2);
    bumped = true;
  } else if (group.position.y > maxY) {
    group.position.y = maxY;
    velocity.y = Math.min(velocity.y, -2);
    bumped = true;
  }
  return bumped;
}

const _flipQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);

// Smoothly rotate group to face `forward`. Keeps world-up locked so the
// shark never barrel-rolls.
function faceVelocity(group, forwardUnit, dt, turnLerp) {
  const m = new THREE.Matrix4();
  const lookTarget = group.position.clone().add(forwardUnit);
  m.lookAt(group.position, lookTarget, _upAxis);
  // lookAt makes local -Z face the target; our shark uses +Z forward.
  _flipQuat.setFromAxisAngle(_upAxis, Math.PI);
  const targetQuat = new THREE.Quaternion()
    .setFromRotationMatrix(m)
    .multiply(_flipQuat);
  const t = 1 - Math.exp(-turnLerp * dt);
  group.quaternion.slerp(targetQuat, t);
}

function tickChomp(state, mouth, dt) {
  if (state.chompTimer > 0) {
    state.chompTimer = Math.max(0, state.chompTimer - dt);
    const t = state.chompTimer / 0.2;
    const open = Math.sin(Math.PI * (1 - t));
    mouth.scale.y = mouth.userData.baseScaleY * (1 + open * 3);
  } else {
    mouth.scale.y = mouth.userData.baseScaleY;
  }
}

// ---------------------------------------------------------------------------
// Player shark
// ---------------------------------------------------------------------------
export function createShark(scene) {
  const { group, body, mouth } = buildSharkMesh(PLAYER_PALETTE);
  group.position.set(0, 0, 0);
  scene.add(group);

  const velocity = new THREE.Vector3();
  const desiredVelocity = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const state = { chompTimer: 0 };
  let bobPhase = 0;

  function getForward(out) {
    out.set(0, 0, 1).applyQuaternion(group.quaternion);
    return out;
  }

  function update(dt, input) {
    const forwardAmt = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafeAmt = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const verticalAmt = (input.up ? 1 : 0) - (input.down ? 1 : 0);

    // World-relative movement so screen-left always goes left.
    desiredVelocity.set(strafeAmt, verticalAmt, -forwardAmt);
    if (desiredVelocity.lengthSq() > 0) {
      desiredVelocity.normalize().multiplyScalar(PLAYER_SPEED);
    }

    const lerpAmt = 1 - Math.exp(-ACCEL * dt);
    velocity.lerp(desiredVelocity, lerpAmt);
    group.position.addScaledVector(velocity, dt);

    group.userData.bumped = clampToWorld(group, velocity);

    if (velocity.lengthSq() > 0.05) {
      tmpForward.copy(velocity).normalize();
      faceVelocity(group, tmpForward, dt, TURN_LERP);
    }

    tickChomp(state, mouth, dt);

    // Body bob
    bobPhase += dt * (1 + velocity.length() * 0.2);
    body.position.y = Math.sin(bobPhase * 4) * 0.06;
    body.rotation.z = Math.sin(bobPhase * 4) * 0.05;
  }

  function chomp() {
    state.chompTimer = 0.2;
  }

  function getCameraTarget() {
    getForward(tmpForward);
    cameraTarget
      .copy(group.position)
      .addScaledVector(tmpForward, -7)
      .add(new THREE.Vector3(0, 3, 0));
    return cameraTarget;
  }

  return {
    group,
    mesh: group,
    get position() {
      return group.position;
    },
    get velocity() {
      return velocity;
    },
    update,
    chomp,
    getCameraTarget,
    getForward
  };
}

// ---------------------------------------------------------------------------
// Rival shark — slow AI competitor that hunts the nearest fish.
// ---------------------------------------------------------------------------
export function createRivalShark(scene) {
  const { group, body, mouth } = buildSharkMesh(RIVAL_PALETTE);
  // Spawn the rival on the opposite side of the map from origin so the
  // player gets a head start.
  group.position.set(
    WORLD.halfX * 0.55 * (Math.random() < 0.5 ? -1 : 1),
    Math.random() * 6 + 2,
    WORLD.halfZ * 0.55 * (Math.random() < 0.5 ? -1 : 1)
  );
  scene.add(group);

  const velocity = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();
  const wanderTarget = new THREE.Vector3();
  const state = { chompTimer: 0 };
  let bobPhase = Math.random() * Math.PI * 2;
  let wanderTimer = 0;
  let hasWanderTarget = false;

  function pickWander() {
    wanderTarget.set(
      (Math.random() * 2 - 1) * (WORLD.halfX - 6),
      WORLD.floorY + 4 + Math.random() * (WORLD.surfaceY - WORLD.floorY - 8),
      (Math.random() * 2 - 1) * (WORLD.halfZ - 6)
    );
    wanderTimer = 4 + Math.random() * 4;
    hasWanderTarget = true;
  }

  function update(dt, prey) {
    // prey: nearest fish object with .mesh.position, or null
    if (prey) {
      desired.copy(prey.mesh.position).sub(group.position);
      hasWanderTarget = false;
    } else {
      wanderTimer -= dt;
      if (!hasWanderTarget || wanderTimer <= 0) pickWander();
      desired.copy(wanderTarget).sub(group.position);
    }

    const distSq = desired.lengthSq();
    if (distSq > 0.0001) {
      desired.multiplyScalar(RIVAL_SPEED / Math.sqrt(distSq));
    } else {
      desired.set(0, 0, 0);
    }

    const lerpAmt = 1 - Math.exp(-1.8 * dt);
    velocity.lerp(desired, lerpAmt);
    group.position.addScaledVector(velocity, dt);

    clampToWorld(group, velocity);

    if (velocity.lengthSq() > 0.05) {
      tmpForward.copy(velocity).normalize();
      faceVelocity(group, tmpForward, dt, RIVAL_TURN_LERP);
    }

    tickChomp(state, mouth, dt);

    bobPhase += dt * 1.3;
    body.position.y = Math.sin(bobPhase * 3.2) * 0.05;
    body.rotation.z = Math.sin(bobPhase * 3.2) * 0.04;
  }

  function chomp() {
    state.chompTimer = 0.2;
  }

  return {
    group,
    mesh: group,
    get position() {
      return group.position;
    },
    update,
    chomp
  };
}
