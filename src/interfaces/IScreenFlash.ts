/**
 * Screen flash color states
 */
export enum FlashColor {
  BLACK = 0,
  WHITE = 1,
}

/**
 * Interface for controlling screen flash effects
 */
export interface IScreenFlashController {
  /**
   * Set the screen to a specific color
   */
  setColor(color: FlashColor): void;

  /**
   * Hide the flash overlay
   */
  hide(): void;

  /**
   * Show the flash overlay
   */
  show(): void;

  /**
   * Dispose of the flash overlay and cleanup resources
   */
  dispose(): void;
}
