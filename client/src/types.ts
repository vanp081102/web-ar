/**
 * A single trackable product: one 2D printed Image Target mapped to AR content.
 * Adding a new product is purely data — no AR engine code changes required.
 */
export interface ProductConfig {
  /** Unique id, also used as the URL slug: /ar/:id */
  id: string;
  name: string;
  /** Path to the *compiled* .mind target file (not the raw .jpg) */
  targetImage: string;
  /** Raw reference image printed on the package (also used for image-3d display) */
  previewImage: string;
  /**
   * What appears when the target is found:
   * - `image-3d` (default): the scanned image itself as a floating 3D card
   * - `model`: a separate .glb product model
   */
  display?: 'image-3d' | 'model';
  /** Path to .glb — required when display === 'model' */
  model?: string;
  /**
   * Real-world width of the printed image target, in meters.
   * Used as documentation / future scale hints; MindAR encodes size in .mind.
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
