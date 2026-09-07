import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { ARManager } from './ar/ARManager';
import { CameraManager } from './ar/CameraManager';
import { LoadingScreen } from './ui/LoadingScreen';
import { PermissionScreen } from './ui/PermissionScreen';
import { ARControls } from './ui/ARControls';
import { fetchProduct, getProductIdFromLocation } from './config/products';
import type { ProductConfig } from './types';

/**
 * Application bootstrap. Kept as a single orchestrating function so the
 * full flow — loading → permission → AR → found/lost — is readable
 * top-to-bottom; each step delegates to a focused class.
 */
async function bootstrap(): Promise<void> {
  const loadingScreen = new LoadingScreen();
  const permissionScreen = new PermissionScreen();
  const arContainer = requireElement('#ar-container');

  loadingScreen.show('Đang khởi tạo AR...');

  const productId = getProductIdFromLocation();
  if (!productId) {
    loadingScreen.hide();
    permissionScreen.showError(
      'Không tìm thấy mã sản phẩm. Mở URL dạng /ar/product-001 hoặc ?product=product-001',
      { allowRetry: false },
    );
    return;
  }

  let product: ProductConfig;
  try {
    product = await fetchProduct(productId);
  } catch (error) {
    loadingScreen.hide();
    permissionScreen.showError((error as Error).message, { allowRetry: false });
    return;
  }

  document.title = `AR • ${product.name}`;

  const support = CameraManager.checkSupport();
  if (!support.supported) {
    loadingScreen.hide();
    permissionScreen.showUnsupported(support.reason);
    permissionScreen.onOpenFallbackViewer(() => startFallbackViewer(product));
    return;
  }

  loadingScreen.hide();
  permissionScreen.show();

  let arManager: ARManager | null = null;
  let started = false;

  // Safari requires getUserMedia() from a user gesture; show copy first.
  permissionScreen.onRequestPermission(async () => {
    if (started) return;
    permissionScreen.hide();
    loadingScreen.show('Đang khởi tạo Camera...');

    arManager?.stop();
    arManager = new ARManager(arContainer);
    const arControls = new ARControls(product);

    try {
      await arManager.start(product);
    } catch (error) {
      arManager.stop();
      arManager = null;
      loadingScreen.hide();
      permissionScreen.showError((error as Error).message);
      return;
    }

    started = true;
    loadingScreen.hide();
    arControls.show();
    arManager.onTrackingStateChange((state) => arControls.updateTrackingState(state));

    // pagehide: real leave/unload. Do NOT stop on visibilitychange alone —
    // iOS Safari fires "hidden" when opening Control Center / switching apps
    // briefly; permanently stopping would break resume.
    const teardown = () => {
      arManager?.stop();
      arManager = null;
    };
    window.addEventListener('pagehide', teardown, { once: true });
  });
}

/**
 * Fallback for devices/browsers that can't run WebAR: rotate/zoom 3D viewer.
 */
function startFallbackViewer(product: ProductConfig): void {
  const container = requireElement('#ar-container');
  document.querySelector<HTMLElement>('#unsupported-screen')!.hidden = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 0.15, 0.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(0.5, 1, 0.75);
  scene.add(key);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, product.position.y, 0);

  new GLTFLoader().load(
    product.model,
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(product.scale, product.scale, product.scale);
      model.position.set(product.position.x, product.position.y, product.position.z);
      model.rotation.set(product.rotation.x, product.rotation.y, product.rotation.z);
      scene.add(model);
    },
    undefined,
    (error) => {
      console.error('Failed to load fallback model:', error);
    },
  );

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

function requireElement(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing required DOM element: ${selector}`);
  return el;
}

bootstrap().catch((error) => {
  console.error('Fatal error bootstrapping WebAR app:', error);
});
