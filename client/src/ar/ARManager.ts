import * as THREE from 'three';
// MindAR ships its Three.js integration as a pre-built ESM/UMD bundle
// (no official @types package as of mind-ar 1.2.x); types come from the
// ambient declaration in src/mind-ar.d.ts.
// Docs: https://hiukim.github.io/mind-ar-js-doc/
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';

import type { ProductConfig } from '../types';
import { ImageTargetManager, type MindARAnchor, type TrackingStateListener } from './ImageTargetManager';
import { ModelManager } from './ModelManager';
import { CameraManager } from './CameraManager';

/**
 * Orchestrates the WebAR engine end-to-end:
 *  1. Boot MindAR against a compiled .mind target file.
 *  2. Ask the browser for camera permission (single native prompt).
 *  3. Set up Three.js lighting so the .glb model is visibly lit.
 *  4. Create one ImageTargetManager for the product's anchor and start
 *     the render loop.
 *
 * IMPORTANT: this performs *real* CPU/GPU image tracking (MindAR runs a
 * feature-matching + optical-flow pipeline over the live camera feed via
 * WebGL + Web Workers). Position/rotation of the model every frame comes
 * directly from anchor.group's transform updated by MindAR.
 */
export class ARManager {
  private mindarThree: InstanceType<typeof MindARThree> | null = null;
  private imageTargetManager: ImageTargetManager | null = null;
  private readonly modelManager = new ModelManager();
  private running = false;

  constructor(private readonly container: HTMLElement) {}

  /**
   * Starts the camera + tracking pipeline for a given product.
   * Throws if the browser denies camera permission or MindAR fails to
   * initialize — callers should catch and show permission/unsupported UI.
   */
  async start(product: ProductConfig): Promise<void> {
    const support = CameraManager.checkSupport();
    if (!support.supported) {
      throw new Error(support.reason ?? 'Thiết bị không hỗ trợ WebAR.');
    }

    this.mindarThree = new MindARThree({
      container: this.container,
      imageTargetSrc: product.targetImage,
      maxTrack: 1,
      // Keep MindAR's own overlays off — we render LoadingScreen/ARControls.
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      filterMinCF: 0.0001,
      filterBeta: 0.001,
    });

    const { renderer, scene, camera } = this.mindarThree;
    this.setupLighting(scene);
    this.setupRenderer(renderer);

    // addAnchor(targetIndex): index into the compiled .mind file's target
    // list. This MVP compiles exactly one image per product, so index 0.
    const anchor = this.mindarThree.addAnchor(0) as MindARAnchor;
    this.imageTargetManager = new ImageTargetManager(anchor, product, this.modelManager);

    try {
      await this.imageTargetManager.prepare();
      // Triggers the native getUserMedia() camera permission prompt in Safari.
      await this.mindarThree.start();
    } catch (error) {
      this.cleanupPartialStart();
      throw new Error(CameraManager.describeError(error));
    }

    this.running = true;
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  }

  onTrackingStateChange(listener: TrackingStateListener): () => void {
    if (!this.imageTargetManager) {
      throw new Error('ARManager.start() phải được gọi trước khi lắng nghe trạng thái tracking.');
    }
    return this.imageTargetManager.onStateChange(listener);
  }

  /** Soft key + ambient so glTF PBR materials render without embedded lights. */
  private setupLighting(scene: THREE.Scene): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(0.5, 1, 0.75);
    scene.add(key);
  }

  private setupRenderer(renderer: THREE.WebGLRenderer): void {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /** Rolls back a failed start() so the user can retry cleanly. */
  private cleanupPartialStart(): void {
    this.imageTargetManager?.dispose();
    this.imageTargetManager = null;
    this.modelManager.clearCache();

    if (this.mindarThree) {
      try {
        this.mindarThree.renderer.setAnimationLoop(null);
        this.mindarThree.stop();
      } catch {
        // stop() may throw if start() never succeeded — ignore.
      }
      try {
        this.mindarThree.renderer.dispose();
      } catch {
        // ignore
      }
      this.mindarThree = null;
    }

    this.container.replaceChildren();
    this.running = false;
  }

  /** Fully tears down camera stream, render loop, and GPU resources. */
  stop(): void {
    if (!this.running && !this.mindarThree) return;
    this.running = false;

    this.imageTargetManager?.dispose();
    this.imageTargetManager = null;

    this.modelManager.clearCache();
    this.modelManager.disposeLoader();

    if (this.mindarThree) {
      try {
        this.mindarThree.renderer.setAnimationLoop(null);
        this.mindarThree.stop();
        this.mindarThree.renderer.dispose();
      } catch {
        // ignore teardown races on iOS Safari
      }
      this.mindarThree = null;
    }

    this.container.replaceChildren();
  }
}
