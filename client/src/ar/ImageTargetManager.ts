import * as THREE from 'three';
import type { ProductConfig, TrackingState } from '../types';
import { ModelManager } from './ModelManager';

/**
 * MindAR's Three.js integration exposes an "anchor" per tracked image
 * target: a THREE.Group whose local transform is updated every frame by
 * the tracking engine to match the target image's real-world position,
 * rotation, and scale in camera space. Anything added as a child of
 * anchor.group inherits that live transform automatically — this is what
 * makes the model "stick" to the physical package as the phone moves.
 *
 * This class owns exactly one target's model lifecycle: load once,
 * show/hide on found/lost, dispose on teardown.
 */

/** Structural type for the anchor object returned by mindarThree.addAnchor() */
export interface MindARAnchor {
  group: THREE.Group;
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}

export type TrackingStateListener = (state: TrackingState) => void;

export class ImageTargetManager {
  private model: THREE.Group | null = null;
  private state: TrackingState = 'idle';
  private readonly listeners = new Set<TrackingStateListener>();
  /** Grace period before hiding the model after target loss, to smooth
   *  brief tracking dropouts (motion blur, momentary occlusion). */
  private lostTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly LOST_GRACE_PERIOD_MS = 600;

  constructor(
    private readonly anchor: MindARAnchor,
    private readonly product: ProductConfig,
    private readonly modelManager: ModelManager,
  ) {
    this.anchor.onTargetFound = () => this.handleTargetFound();
    this.anchor.onTargetLost = () => this.handleTargetLost();
  }

  onStateChange(listener: TrackingStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(next: TrackingState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  /** Loads product.glb and attaches it to the anchor, hidden until found. */
  async prepare(): Promise<void> {
    this.setState('scanning');
    this.model = await this.modelManager.load(this.product);
    this.model.visible = false;
    this.anchor.group.add(this.model);
  }

  private handleTargetFound(): void {
    if (this.lostTimeout) {
      clearTimeout(this.lostTimeout);
      this.lostTimeout = null;
    }
    if (this.model) this.model.visible = true;
    this.setState('found');
  }

  private handleTargetLost(): void {
    // Debounce: don't immediately hide, in case tracking recovers within
    // the grace period (see class doc comment).
    this.lostTimeout = setTimeout(() => {
      if (this.model) this.model.visible = false;
      this.setState('lost');
    }, ImageTargetManager.LOST_GRACE_PERIOD_MS);
  }

  getTrackingState(): TrackingState {
    return this.state;
  }

  dispose(): void {
    if (this.lostTimeout) clearTimeout(this.lostTimeout);
    if (this.model) {
      this.anchor.group.remove(this.model);
      this.modelManager.dispose(this.model);
      this.model = null;
    }
    this.listeners.clear();
  }
}
