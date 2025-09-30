import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoEncoderService } from '../VideoEncoderService';
import { ConsoleLogger } from '../Logger';
import { LogLevel } from '../../interfaces/ILogger';

// Mock VideoEncoder
class MockVideoEncoder {
  static isConfigSupported = vi.fn();
  configure = vi.fn();
  encode = vi.fn();
  flush = vi.fn();
  close = vi.fn();
  state: string = 'configured';

  constructor(private init: any) {}

  triggerOutput(chunk: any) {
    this.init.output(chunk);
  }

  triggerError(error: Error) {
    this.init.error(error);
  }
}

global.VideoEncoder = MockVideoEncoder as any;

// Mock EncodedVideoChunk
class MockEncodedVideoChunk {
  constructor(public init: any) {}

  get type() {
    return this.init.type;
  }

  get timestamp() {
    return this.init.timestamp;
  }

  get duration() {
    return this.init.duration;
  }

  get byteLength() {
    return this.init.data.byteLength;
  }

  copyTo(dest: ArrayBuffer) {
    const src = new Uint8Array(this.init.data);
    const dst = new Uint8Array(dest);
    dst.set(src);
  }
}

global.EncodedVideoChunk = MockEncodedVideoChunk as any;

describe('VideoEncoderService', () => {
  let service: VideoEncoderService;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger('Test', LogLevel.ERROR);
    service = new VideoEncoderService(logger);
    vi.clearAllMocks();

    MockVideoEncoder.isConfigSupported.mockResolvedValue({
      supported: true,
      config: {},
    });
  });

  describe('initialize', () => {
    it('should initialize encoder with valid config', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);

      expect(MockVideoEncoder.isConfigSupported).toHaveBeenCalledWith(config);
    });

    it('should throw error when codec is not supported', async () => {
      MockVideoEncoder.isConfigSupported.mockResolvedValue({
        supported: false,
        config: null,
      });

      const config = {
        codec: 'unsupported',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await expect(service.initialize(config)).rejects.toThrow(
        'Codec unsupported is not supported'
      );
    });
  });

  describe('encodeFrame', () => {
    it('should throw error when encoder not initialized', async () => {
      const mockFrame = { timestamp: 0, close: vi.fn() } as any;

      await expect(service.encodeFrame(mockFrame)).rejects.toThrow(
        'Encoder not initialized'
      );
    });

    it('should encode frame and close it', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);

      const mockFrame = { timestamp: 1000, close: vi.fn() } as any;
      await service.encodeFrame(mockFrame, false);

      expect(mockFrame.close).toHaveBeenCalled();
    });

    it('should encode keyframe when specified', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);

      const mockFrame = { timestamp: 0, close: vi.fn() } as any;
      await service.encodeFrame(mockFrame, true);

      expect(mockFrame.close).toHaveBeenCalled();
    });
  });

  describe('getEncodedChunks', () => {
    it('should return empty array initially', () => {
      const chunks = service.getEncodedChunks();
      expect(chunks).toEqual([]);
    });

    it('should store encoded chunks from output callback', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);

      // Simulate encoder output
      const mockChunk = {
        type: 'key',
        timestamp: 1000,
        duration: 33,
        byteLength: 1024,
        copyTo: vi.fn((dest: ArrayBuffer) => {
          new Uint8Array(dest).fill(1);
        }),
      };

      // Trigger output callback manually
      const encoder = (service as any).encoder as MockVideoEncoder;
      encoder.triggerOutput(mockChunk);

      const chunks = service.getEncodedChunks();
      expect(chunks).toHaveLength(1);
      expect(chunks[0].timestamp).toBe(1000);
      expect(chunks[0].type).toBe('key');
    });
  });

  describe('flush', () => {
    it('should throw error when encoder not initialized', async () => {
      await expect(service.flush()).rejects.toThrow('Encoder not initialized');
    });

    it('should flush encoder', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);

      const encoder = (service as any).encoder as MockVideoEncoder;
      encoder.flush.mockResolvedValue(undefined);

      await service.flush();
      expect(encoder.flush).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should close encoder and clear chunks', async () => {
      const config = {
        codec: 'vp8',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      };

      await service.initialize(config);
      service.dispose();

      const chunks = service.getEncodedChunks();
      expect(chunks).toEqual([]);
    });

    it('should handle dispose without initialization', () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
