import * as THREE from 'three';
import { WORLD } from './scene.js';

const SHARK_SPEED = 7; // units / sec
const ACCEL = 6; // velocity lerp factor
const TURN_LERP = 6; // rotation lerp factor

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);

const MAT_GRAY = new THREE.MeshLambertMaterial({ color: 0xb8c0c8, flatShading: true });
const MAT_WHITE = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, flatShading: true });
const MAT_DARK_GRAY = new THREE.MeshLambertMaterial({ color: 0x707880, flatShading: true });
const MAT_BLACK = new THREE.MeshLambertMaterial({ color: 0x101010, flatShading: true });
const MAT_PINK_MOUTH = new THREE.MeshLambertMaterial({ color: 0xff9aa8, flatShading: true });

function block(material, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(SHARED_BOX, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

export function createShark(scene) {
  const group = new THREE.Group();

  // The shark's "forward" is +Z in this construction. We'll wrap it in an
  // outer group so we can rotate it from the outside, and use the inner
  // group to hold the parts (and animate the mouth).
  const body = new THREE.Group();
  group.add(body);

  // Main body (long block) — gray top, white belly handled with a stacked
  // pair so the "belly" is visible from below.
  body.add(block(MAT_GRAY, 1.2, 0.9, 3.0, 0, 0.15, 0));
  body.add(block(MAT_WHITE, 1.21, 0.4, 2.8, 0, -0.3, 0));

  // Head (a slightly bigger cube at front)
  body.add(block(MAT_GRAY, 1.3, 1.0, 1.0, 0, 0.15, 1.6));
  body.add(block(MAT_WHITE, 1.31, 0.4, 0.95, 0, -0.3, 1.6));

  // Mouth — a small pink block on the front, scaled up briefly when chomping
  const mouth = block(MAT_PINK_MOUTH, 0.9, 0.18, 0.2, 0, -0.18, 2.15);
  mouth.userData.baseScaleY = 0.18;
  body.add(mouth);

  // Eyes — small black cubes on each side of the head
  body.add(block(MAT_BLACK, 0.18, 0.18, 0.18, 0.55, 0.35, 1.95));
  body.add(block(MAT_BLACK, 0.18, 0.18, 0.18, -0.55, 0.35, 1.95));

  // Tail (triangular-ish: stacked cubes that taper)
  body.add(block(MAT_GRAY, 0.8, 0.8, 0.8, 0, 0.2, -1.8));
  body.add(block(MAT_DARK_GRAY, 0.4, 1.3, 0.6, 0, 0.6, -2.3)); // upper tail fin
  body.add(block(MAT_DARK_GRAY, 0.4, 0.6, 0.5, 0, -0.2, -2.2)); // lower tail fin

  // Side fins
  body.add(block(MAT_DARK_GRAY, 1.4, 0.15, 0.6, 0, -0.05, 0.4));
  // Top fin
  body.add(block(MAT_DARK_GRAY, 0.18, 0.9, 0.7, 0, 0.95, 0.1));

  // Place shark at origin, slightly above floor.
  group.position.set(0, 0, 0);

  scene.add(group);

  // State
  const velocity = new THREE.Vector3();
  const desiredVelocity = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();
  // Internal heading expressed as quaternion target.
  const targetQuat = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);

  let chompTimer = 0;

  // Camera target helper
  const cameraTarget = new THREE.Vector3();

  // Bobbing animation phase
  let bobPhase = 0;

  function getForward(out) {
    // Shark mesh is built with +Z as forward. After rotation, derive forward.
    out.set(0, 0, 1).applyQuaternion(group.quaternion);
    return out;
  }

  function update(dt, input) {
    // Build desired velocity from input. Movement is camera/world-relative
    // along the world axes using the shark's heading for forward/back/strafe.
    const forwardAmt = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafeAmt = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const verticalAmt = (input.up ? 1 : 0) - (input.down ? 1 : 0);

    // For kid-friendly controls we drive the shark with world-relative
    // movement (forward = -Z world), and rotate the mesh to face the
    // movement direction. This makes "left arrow" always go left on screen.
    desiredVelocity.set(strafeAmt, verticalAmt, -forwardAmt);
    if (desiredVelocity.lengthSq() > 0) {
      desiredVelocity.normalize().multiplyScalar(SHARK_SPEED);
    }

    // Lerp current velocity toward desired (smoothing).
    const lerpAmt = 1 - Math.exp(-ACCEL * dt);
    velocity.lerp(desiredVelocity, lerpAmt);

    // Apply velocity to position
    group.position.addScaledVector(velocity, dt);

    // Soft world bounds — gently bounce back from edges.
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
    group.userData.bumped = bumped;

    // Rotate the mesh to face velocity (smoothly). lookAt-style basis keeps
    // world-up aligned, so the shark never barrel-rolls.
    if (velocity.lengthSq() > 0.05) {
      tmpForward.copy(velocity).normalize();
      const m = new THREE.Matrix4();
      const lookTarget = group.position.clone().add(tmpForward);
      m.lookAt(group.position, lookTarget, upAxis);
      // lookAt makes local -Z face the target; our shark uses +Z forward, so
      // we flip 180° around Y.
      const flip = new THREE.Quaternion().setFromAxisAngle(upAxis, Math.PI);
      targetQuat.setFromRotationMatrix(m).multiply(flip);
      const turnAmt = 1 - Math.exp(-TURN_LERP * dt);
      group.quaternion.slerp(targetQuat, turnAmt);
    }

    // Mouth chomp animation
    if (chompTimer > 0) {
      chompTimer = Math.max(0, chompTimer - dt);
      const t = chompTimer / 0.2; // 0..1
      // Ease out a small open
      const open = Math.sin(Math.PI * (1 - t)); // 0 -> 1 -> 0
      mouth.scale.y = mouth.userData.baseScaleY * (1 + open * 3);
    } else {
      mouth.scale.y = mouth.userData.baseScaleY;
    }

    // Gentle bob of the body to give a swimming feel
    bobPhase += dt * (1 + velocity.length() * 0.2);
    body.position.y = Math.sin(bobPhase * 4) * 0.06;
    body.rotation.z = Math.sin(bobPhase * 4) * 0.05;
  }

  function chomp() {
    chompTimer = 0.2;
  }

  function getCameraTarget() {
    // Behind & above shark, in shark-forward space.
    getForward(tmpForward);
    cameraTarget
      .copy(group.position)
      .addScaledVector(tmpForward, -7)
      .add(new THREE.Vector3(0, 3, 0));
    return cameraTarget;
  }

  return {
    group,
    mesh: group, // for Box3.setFromObject
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
