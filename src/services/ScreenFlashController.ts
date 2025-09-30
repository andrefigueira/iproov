import { IScreenFlashController, FlashColor } from '../interfaces/IScreenFlash';
import { ILogger } from '../interfaces/ILogger';

/**
 * Controls screen flash overlay for black/white transitions
 * Implements Single Responsibility Principle - only handles screen flashing
 */
export class ScreenFlashController implements IScreenFlashController {
  private overlay: HTMLDivElement | null = null;

  constructor(private readonly logger: ILogger) {
    this.createOverlay();
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'flash-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;
      pointer-events: none;
      transition: background-color 0.05s ease;
      display: none;
    `;
    document.body.appendChild(this.overlay);
    this.logger.debug('Flash overlay created');
  }

  setColor(color: FlashColor): void {
    if (!this.overlay) {
      this.logger.warn('Overlay not initialized');
      return;
    }

    const backgroundColor = color === FlashColor.BLACK ? '#000000' : '#FFFFFF';
    this.overlay.style.backgroundColor = backgroundColor;
    this.logger.debug(`Set flash color to ${color === FlashColor.BLACK ? 'BLACK' : 'WHITE'}`);
  }

  show(): void {
    if (!this.overlay) {
      this.logger.warn('Overlay not initialized');
      return;
    }

    this.overlay.style.display = 'block';
    this.logger.debug('Flash overlay shown');
  }

  hide(): void {
    if (!this.overlay) {
      this.logger.warn('Overlay not initialized');
      return;
    }

    this.overlay.style.display = 'none';
    this.logger.debug('Flash overlay hidden');
  }

  dispose(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
      this.overlay = null;
      this.logger.debug('Flash overlay disposed');
    }
  }
}
