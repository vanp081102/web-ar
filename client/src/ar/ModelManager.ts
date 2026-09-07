import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ProductConfig } from '../types';

/**
 * Builds the 3D content attached to a tracked image target.
 *
 * Two modes (see ProductConfig.display):
 * - `image-3d`: textured 3D card of the scanned image (open cam → scan → see
 *   that image as realtime 3D). Default for the packaging MVP.
 * - `model`: load a separate .glb (product hero model).
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
   * Creates a thin 3D card textured with previewImage.
   * In MindAR anchor space the tracked image is ~1 unit wide on the XY plane;
   * we float the card slightly above so it reads clearly as AR (not the paper).
   */
  private async loadImageCard(product: ProductConfig): Promise<THREE.Group> {
    const cacheKey = `image-3d:${product.previewImage}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const clone = cached.clone(true);
      this.applyTransform(clone, product);
      return clone;
    }

    const texture = await this.textureLoader.loadAsync(product.previewImage);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const img = texture.image as { width: number; height: number };
    const aspect = img.height > 0 ? img.width / img.height : 1;
    // MindAR target plane width ≈ 1; match that so the card aligns with print size.
    const width = 1;
    const height = width / aspect;
    const thickness = 0.02;

    const group = new THREE.Group();

    const frontMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
      metalness: 0,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      metalness: 0,
    });

    // Box with per-face materials: +Z front gets the photo.
    const geometry = new THREE.BoxGeometry(width, height, thickness);
    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
    const card = new THREE.Mesh(geometry, materials);
    // Sit just above the physical print so tracking still reads as "on the image".
    card.position.z = thickness / 2 + 0.01;
    group.add(card);

    // Soft shadow plane under the card (visual depth cue, not a real shadow map).
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.92, height * 0.92),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    shadow.position.z = 0.002;
    group.add(shadow);

    this.cache.set(cacheKey, group);

    const instance = group.clone(true);
    this.applyTransform(instance, product);
    return instance;
  }

  private async loadGlb(product: ProductConfig): Promise<THREE.Group> {
    if (!product.model) {
      throw new Error('display=model yêu cầu trường "model" (.glb).');
    }

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
