export class PermissionScreen {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly errorText: HTMLElement;

  private readonly unsupportedRoot: HTMLElement;
  private readonly fallbackButton: HTMLButtonElement;

  constructor() {
    this.root = this.require('#permission-screen');
    this.button = this.require<HTMLButtonElement>('#permission-button');
    this.errorText = this.require('#permission-error');

    this.unsupportedRoot = this.require('#unsupported-screen');
    this.fallbackButton = this.require<HTMLButtonElement>('#fallback-viewer-button');
  }

  show(): void {
    this.button.hidden = false;
    this.errorText.hidden = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  showError(message: string, options?: { allowRetry?: boolean }): void {
    this.errorText.textContent = message;
    this.errorText.hidden = false;
    this.root.hidden = false;
    this.unsupportedRoot.hidden = true;
    // Fatal catalog/URL errors shouldn't invite another camera permission tap.
    this.button.hidden = options?.allowRetry === false;
  }

  onRequestPermission(handler: () => void): void {
    this.button.addEventListener('click', handler);
  }

  showUnsupported(reason?: string): void {
    this.unsupportedRoot.hidden = false;
    if (reason) {
      const detail = this.unsupportedRoot.querySelector('.unsupported-reason');
      if (detail) detail.textContent = reason;
    }
  }

  onOpenFallbackViewer(handler: () => void): void {
    this.fallbackButton.addEventListener('click', handler);
  }

  private require<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Missing required DOM element: ${selector}`);
    return el;
  }
}
