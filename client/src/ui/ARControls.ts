import type { ProductConfig, TrackingState } from '../types';

/** Controls the in-AR heads-up display: status text + CTA chips shown
 *  once a target has been found. */
export class ARControls {
  private readonly hud: HTMLElement;
  private readonly status: HTMLElement;
  private readonly actions: HTMLElement;

  constructor(private readonly product: ProductConfig) {
    this.hud = this.require('#ar-hud');
    this.status = this.require('#hud-status');
    this.actions = this.require('#ar-actions');
    this.bindActionButtons();
  }

  show(): void {
    this.hud.hidden = false;
  }

  hide(): void {
    this.hud.hidden = true;
  }

  updateTrackingState(state: TrackingState): void {
    switch (state) {
      case 'scanning':
        this.status.textContent = 'Hướng camera vào flashcard / ảnh in';
        this.actions.hidden = true;
        break;
      case 'found':
        this.status.textContent = 'Đã khóa target — model 3D đang bám theo card';
        this.actions.hidden = !this.product.actions;
        break;
      case 'lost':
        this.status.textContent = 'Hướng camera vào flashcard / ảnh in';
        this.actions.hidden = true;
        break;
      default:
        break;
    }
  }

  private bindActionButtons(): void {
    this.actions.querySelectorAll<HTMLButtonElement>('.chip-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action as keyof NonNullable<ProductConfig['actions']>;
        const url = this.product.actions?.[action];
        if (url) window.open(url, '_blank', 'noopener');
      });
    });
  }

  private require(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Missing required DOM element: ${selector}`);
    return el;
  }
}
