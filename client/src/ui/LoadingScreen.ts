/** Thin wrapper around the #loading-screen overlay defined in index.html. */
export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;

  constructor() {
    this.root = this.require('#loading-screen');
    this.text = this.require('#loading-text');
  }

  show(message = 'Đang khởi tạo AR...'): void {
    this.text.textContent = message;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private require(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Missing required DOM element: ${selector}`);
    return el;
  }
}
