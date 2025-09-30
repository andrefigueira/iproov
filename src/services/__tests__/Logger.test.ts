import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLogger } from '../Logger';
import { LogLevel } from '../../interfaces/ILogger';

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default name and level', () => {
      logger = new ConsoleLogger();
      logger.debug('test');
      expect(consoleDebugSpy).toHaveBeenCalledWith('[App] [DEBUG] test');
    });

    it('should create logger with custom name', () => {
      logger = new ConsoleLogger('TestService');
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[TestService] [INFO] test');
    });

    it('should create logger with custom log level', () => {
      logger = new ConsoleLogger('Test', LogLevel.WARN);
      logger.debug('should not log');
      logger.info('should not log');
      logger.warn('should log');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should change log level', () => {
      logger = new ConsoleLogger('Test', LogLevel.DEBUG);
      logger.debug('test1');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);

      logger.setLevel(LogLevel.ERROR);
      logger.debug('test2');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('debug', () => {
    it('should log debug messages when level is DEBUG', () => {
      logger = new ConsoleLogger('Test', LogLevel.DEBUG);
      logger.debug('debug message', { data: 'test' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Test] [DEBUG] debug message',
        { data: 'test' }
      );
    });

    it('should not log debug messages when level is higher', () => {
      logger = new ConsoleLogger('Test', LogLevel.INFO);
      logger.debug('debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages when level is INFO or lower', () => {
      logger = new ConsoleLogger('Test', LogLevel.INFO);
      logger.info('info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[Test] [INFO] info message');
    });

    it('should not log info messages when level is higher', () => {
      logger = new ConsoleLogger('Test', LogLevel.WARN);
      logger.info('info message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warn messages', () => {
      logger = new ConsoleLogger('Test', LogLevel.WARN);
      logger.warn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Test] [WARN] warning message');
    });
  });

  describe('error', () => {
    it('should log error messages with Error object', () => {
      logger = new ConsoleLogger('Test', LogLevel.ERROR);
      const error = new Error('Test error');
      logger.error('error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Test] [ERROR] error message',
        error
      );
    });

    it('should log error messages without Error object', () => {
      logger = new ConsoleLogger('Test', LogLevel.ERROR);
      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Test] [ERROR] error message',
        undefined
      );
    });
  });
});
