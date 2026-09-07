/**
 * A single trackable product: one 2D printed Image Target mapped to one
 * .glb model. Adding a new product to the catalog is purely data — no
 * code changes required (see README section 13).
 */
export interface ProductConfig {
  /** Unique id, also used as the URL slug: /ar/:id */
  id: string;
  name: string;
  /** Path to the *compiled* .mind target file (not the raw .jpg) */
  targetImage: string;
  /** Raw reference image, kept for the fallback/product-viewer screen */
  previewImage: string;
  /** Path to the .glb model served from /public/models */
  model: string;
  /**
   * Real-world width of the printed image target, in meters.
   * MindAR scales the tracked plane to exactly this size, which is what
   * keeps the model correctly sized relative to the physical package.
   */
  physicalWidth: number;
  scale: number;
  position: { x: number; y: number; z: number };
  /** Euler rotation in radians */
  rotation: { x: number; y: number; z: number };
  /** Optional call-to-action links shown once the target is found */
  actions?: {
    view?: string;
    recipe?: string;
    buy?: string;
  };
}

export type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export type TrackingState = 'idle' | 'scanning' | 'found' | 'lost';

export interface ARSupportInfo {
  supported: boolean;
  reason?: string;
}
