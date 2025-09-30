import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenFlashController } from '../ScreenFlashController';
import { FlashColor } from '../../interfaces/IScreenFlash';
import { ConsoleLogger } from '../Logger';
import { LogLevel } from '../../interfaces/ILogger';

describe('ScreenFlashController', () => {
  let controller: ScreenFlashController;
  let logger: ConsoleLogger;

  beforeEach(() => {
    // Clear any existing overlays
    document.body.innerHTML = '';
    logger = new ConsoleLogger('Test', LogLevel.ERROR);
    controller = new ScreenFlashController(logger);
  });

  afterEach(() => {
    controller.dispose();
  });

  describe('constructor', () => {
    it('should create overlay element', () => {
      const overlay = document.getElementById('flash-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.style.position).toBe('fixed');
      expect(overlay?.style.display).toBe('none');
    });
  });

  describe('setColor', () => {
    it('should set background color to black', () => {
      controller.setColor(FlashColor.BLACK);
      const overlay = document.getElementById('flash-overlay');
      expect(overlay?.style.backgroundColor).toBe('rgb(0, 0, 0)');
    });

    it('should set background color to white', () => {
      controller.setColor(FlashColor.WHITE);
      const overlay = document.getElementById('flash-overlay');
      expect(overlay?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });

    it('should toggle between colors', () => {
      const overlay = document.getElementById('flash-overlay');

      controller.setColor(FlashColor.BLACK);
      expect(overlay?.style.backgroundColor).toBe('rgb(0, 0, 0)');

      controller.setColor(FlashColor.WHITE);
      expect(overlay?.style.backgroundColor).toBe('rgb(255, 255, 255)');

      controller.setColor(FlashColor.BLACK);
      expect(overlay?.style.backgroundColor).toBe('rgb(0, 0, 0)');
    });
  });

  describe('show', () => {
    it('should display overlay', () => {
      controller.show();
      const overlay = document.getElementById('flash-overlay');
      expect(overlay?.style.display).toBe('block');
    });
  });

  describe('hide', () => {
    it('should hide overlay', () => {
      controller.show();
      controller.hide();
      const overlay = document.getElementById('flash-overlay');
      expect(overlay?.style.display).toBe('none');
    });
  });

  describe('dispose', () => {
    it('should remove overlay from DOM', () => {
      expect(document.getElementById('flash-overlay')).toBeTruthy();
      controller.dispose();
      expect(document.getElementById('flash-overlay')).toBeNull();
    });

    it('should handle multiple dispose calls', () => {
      controller.dispose();
      expect(() => controller.dispose()).not.toThrow();
    });
  });
});
