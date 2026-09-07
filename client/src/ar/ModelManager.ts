import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ProductConfig } from '../types';

/**
 * Loads, positions, and disposes .glb models.
 *
 * Performance notes (see README "Hiệu năng"):
 * - A single GLTFLoader instance is reused (keeps the Draco decoder warm).
 * - Draco decoding is enabled so Draco-compressed .glb exports work.
 * - Models are cached by URL. `dispose()` only detaches a live instance
 *   from the scene; GPU resources are freed in `clearCache()` so we never
 *   dispose shared geometry that clones still reference.
 */
export class ModelManager {
  private readonly loader: GLTFLoader;
  private readonly cache = new Map<string, THREE.Group>();
  private readonly dracoLoader: DRACOLoader;

  constructor() {
    this.dracoLoader = new DRACOLoader();
    // Uses Google's hosted Draco decoder (free CDN). For offline / locked-down
    // networks, copy the three decoder files into /public/draco/ and point here.
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  /**
   * Loads product.model (.glb) and returns a ready-to-anchor THREE.Group
   * with the product's configured position/rotation/scale already applied.
   * Returns a clone so the cache keeps a clean template for reuse.
   */
  async load(product: ProductConfig): Promise<THREE.Group> {
    const cached = this.cache.get(product.model);
    if (cached) {
      const clone = cached.clone(true);
      this.applyTransform(clone, product);
      return clone;
    }

    const gltf = await this.loader.loadAsync(product.model);
    const model = gltf.scene;

    model.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
      }
    });

    this.applyTransform(model, product);
    this.cache.set(product.model, model);

    const instance = model.clone(true);
    this.applyTransform(instance, product);
    return instance;
  }

  applyTransform(model: THREE.Object3D, product: ProductConfig): void {
    model.scale.set(product.scale, product.scale, product.scale);
    model.position.set(product.position.x, product.position.y, product.position.z);
    model.rotation.set(product.rotation.x, product.rotation.y, product.rotation.z);
  }

  /**
   * Detaches a live instance from the scene graph.
   * Does NOT free GPU buffers — clones share geometry/materials with the
   * cached template; freeing them here would corrupt the cache.
   */
  dispose(root: THREE.Object3D): void {
    root.removeFromParent();
  }

  private disposeGpu(root: THREE.Object3D): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.geometry?.dispose();

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        this.disposeMaterial(material);
      }
    });
  }

  private disposeMaterial(material: THREE.Material): void {
    const maybeTextured = material as THREE.MeshStandardMaterial;
    const textureKeys: (keyof THREE.MeshStandardMaterial)[] = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
    ];

    for (const key of textureKeys) {
      const texture = maybeTextured[key] as unknown as THREE.Texture | undefined;
      texture?.dispose();
    }

    material.dispose();
  }

  /** Clears the in-memory model cache and frees GPU resources. */
  clearCache(): void {
    for (const model of this.cache.values()) {
      this.disposeGpu(model);
    }
    this.cache.clear();
  }

  /** Releases Draco decoder workers (call on full app teardown). */
  disposeLoader(): void {
    this.dracoLoader.dispose();
  }
}
