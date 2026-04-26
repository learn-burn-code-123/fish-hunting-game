import * as THREE from 'three';

export const WORLD = {
  // half-extents for x/z, full y range from FLOOR_Y to SURFACE_Y
  halfX: 50,
  halfZ: 50,
  floorY: -30,
  surfaceY: 30
};

export function initScene() {
  const canvas = document.getElementById('game');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();

  // Deep blue gradient background via CSS clear color (we'll layer fog on top).
  const deepBlue = new THREE.Color('#0a1f3d');
  scene.background = deepBlue;
  scene.fog = new THREE.FogExp2(deepBlue.getHex(), 0.015);

  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    400
  );
  camera.position.set(0, 4, 10);
  camera.lookAt(0, 0, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0x4080c0, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8d0, 0.8);
  sun.position.set(20, 60, 10);
  scene.add(sun);

  // Soft hemisphere light to give the scene a watery glow
  const hemi = new THREE.HemisphereLight(0x6fb6ff, 0x0a1f3d, 0.35);
  scene.add(hemi);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  return { scene, camera, renderer };
}
