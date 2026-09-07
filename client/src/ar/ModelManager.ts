import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ProductConfig } from '../types';

/**
 * Builds the 3D content attached to a tracked image target.
 *
 * - `image-3d`: scanned image as a standing 3D pop-up card (clearly visible)
 * - `model`: separate .glb product model
 */
export class ModelManager {
  private readonly loader: GLTFLoader;
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly cache = new Map<string, THREE.Group>();
  private readonly dracoLoader: DRACOLoader;

  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  async load(product: ProductConfig): Promise<THREE.Group> {
    const mode = product.display ?? (product.model ? 'model' : 'image-3d');
    if (mode === 'image-3d') {
      return this.loadImageCard(product);
    }
    return this.loadGlb(product);
  }

  /**
   * Standing pop-up card: rises from the tracked print so the effect is
   * obvious. A flat same-size overlay on the paper is nearly invisible.
   */
  private async loadImageCard(product: ProductConfig): Promise<THREE.Group> {
    const cacheKey = `image-3d:${product.previewImage}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const clone = cached.clone(true);
      this.applyCatalogOffset(clone, product);
      return clone;
    }

    const texture = await this.textureLoader.loadAsync(product.previewImage);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const img = texture.image as { width: number; height: number };
    const aspect = img.height > 0 ? img.width / img.height : 1;
    const width = 1;
    const height = width / aspect;

    // Outer group receives catalog scale/position; inner holds the pop-up pose.
    const root = new THREE.Group();
    const standee = new THREE.Group();

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.1, height * 1.1),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    standee.add(frame);

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    card.position.z = 0.01;
    standee.add(card);

    // Pivot at bottom edge, tilt toward camera (~70°).
    standee.position.set(0, -height / 2, 0.03);
    standee.rotation.x = THREE.MathUtils.degToRad(-70);
    standee.position.y += Math.sin(THREE.MathUtils.degToRad(70)) * (height / 2);

    root.add(standee);
    this.cache.set(cacheKey, root);

    const instance = root.clone(true);
    this.applyCatalogOffset(instance, product);
    return instance;
  }

  private async loadGlb(product: ProductConfig): Promise<THREE.Group> {
    if (!product.model) {
      throw new Error('display=model yêu cầu trường "model" (.glb).');
    }

    const cached = this.cache.get(product.model);
    if (cached) {
      const clone = cached.clone(true);
      this.applyCatalogOffset(clone, product);
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

    this.cache.set(product.model, model);

    const instance = model.clone(true);
    this.applyCatalogOffset(instance, product);
    return instance;
  }

  /** Absolute catalog transform applied once per live instance. */
  applyCatalogOffset(model: THREE.Object3D, product: ProductConfig): void {
    model.scale.set(product.scale, product.scale, product.scale);
    model.position.set(product.position.x, product.position.y, product.position.z);
    model.rotation.set(product.rotation.x, product.rotation.y, product.rotation.z);
  }

  /** @deprecated use applyCatalogOffset */
  applyTransform(model: THREE.Object3D, product: ProductConfig): void {
    this.applyCatalogOffset(model, product);
  }

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

  clearCache(): void {
    for (const model of this.cache.values()) {
      this.disposeGpu(model);
    }
    this.cache.clear();
  }

  disposeLoader(): void {
    this.dracoLoader.dispose();
  }
}
