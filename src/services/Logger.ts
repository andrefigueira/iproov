import { ILogger, LogLevel } from '../interfaces/ILogger';

/**
 * Console-based logger implementation with configurable log levels
 */
export class ConsoleLogger implements ILogger {
  private level: LogLevel;
  private readonly name: string;

  constructor(name: string = 'App', level: LogLevel = LogLevel.DEBUG) {
    this.name = name;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.name}] [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.name}] [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.name}] [WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.name}] [ERROR] ${message}`, error, ...args);
    }
  }
}
