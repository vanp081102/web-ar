/**
 * mind-ar (https://github.com/hiukim/mind-ar-js) does not publish official
 * TypeScript type declarations as of v1.2.x. This minimal ambient module
 * declares the subset of the Three.js integration surface this project
 * uses, so the rest of the codebase can stay in strict TypeScript without
 * scattering `any`/`@ts-ignore` everywhere.
 *
 * Source of truth for this shape: MindAR's official docs and examples —
 * https://hiukim.github.io/mind-ar-js-doc/
 */
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import * as THREE from 'three';

  export interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    maxTrack?: number;
    uiLoading?: 'yes' | 'no';
    uiScanning?: 'yes' | 'no';
    uiError?: 'yes' | 'no';
    filterMinCF?: number;
    filterBeta?: number;
    warmupTolerance?: number;
    missTolerance?: number;
  }

  export interface MindARAnchorLike {
    group: THREE.Group;
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    addAnchor(targetIndex: number): MindARAnchorLike;
    start(): Promise<void>;
    stop(): void;
  }
}
