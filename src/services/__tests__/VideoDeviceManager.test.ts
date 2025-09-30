import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoDeviceManager } from '../VideoDeviceManager';
import { ConsoleLogger } from '../Logger';
import { LogLevel } from '../../interfaces/ILogger';

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();
const mockEnumerateDevices = vi.fn();

global.navigator.mediaDevices = {
  getUserMedia: mockGetUserMedia,
  enumerateDevices: mockEnumerateDevices,
} as any;

describe('VideoDeviceManager', () => {
  let manager: VideoDeviceManager;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger('Test', LogLevel.ERROR);
    manager = new VideoDeviceManager(logger);
    vi.clearAllMocks();
  });

  describe('getAvailableDevices', () => {
    it('should return empty array when no video devices found', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'audioinput', deviceId: 'audio1', label: 'Microphone' },
      ]);

      const devices = await manager.getAvailableDevices();
      expect(devices).toEqual([]);
    });

    it('should enumerate video devices with capabilities', async () => {
      const mockTrack = {
        getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
        getCapabilities: () => ({
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 },
        }),
        stop: vi.fn(),
      };

      const mockStream = {
        getVideoTracks: () => [mockTrack],
        getTracks: () => [mockTrack],
      };

      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'Front Camera' },
        { kind: 'videoinput', deviceId: 'cam2', label: 'Back Camera' },
      ]);

      mockGetUserMedia.mockResolvedValue(mockStream);

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        deviceId: 'cam1',
        label: 'Front Camera',
        width: 1920,
        height: 1080,
        frameRate: 30,
      });
      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should handle errors when getting device capabilities', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'Camera' },
      ]);

      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const devices = await manager.getAvailableDevices();
      expect(devices).toEqual([]);
    });
  });

  describe('getBestDevice', () => {
    it('should throw error when no devices available', async () => {
      mockEnumerateDevices.mockResolvedValue([]);

      await expect(manager.getBestDevice()).rejects.toThrow('No video devices available');
    });

    it('should return device with highest resolution', async () => {
      const mockTrack1 = {
        getSettings: () => ({ width: 1280, height: 720, frameRate: 30 }),
        getCapabilities: () => ({}),
        stop: vi.fn(),
      };

      const mockTrack2 = {
        getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
        getCapabilities: () => ({}),
        stop: vi.fn(),
      };

      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'HD Camera' },
        { kind: 'videoinput', deviceId: 'cam2', label: 'Full HD Camera' },
      ]);

      mockGetUserMedia
        .mockResolvedValueOnce({
          getVideoTracks: () => [mockTrack1],
          getTracks: () => [mockTrack1],
        })
        .mockResolvedValueOnce({
          getVideoTracks: () => [mockTrack2],
          getTracks: () => [mockTrack2],
        });

      const best = await manager.getBestDevice();

      expect(best.width).toBe(1920);
      expect(best.height).toBe(1080);
      expect(best.deviceId).toBe('cam2');
    });
  });

  describe('getMediaStream', () => {
    it('should request media stream with correct constraints', async () => {
      const mockStream = { id: 'stream1' };
      mockGetUserMedia.mockResolvedValue(mockStream);

      const capability = {
        deviceId: 'cam1',
        label: 'Test Camera',
        width: 1920,
        height: 1080,
        frameRate: 30,
      };

      const stream = await manager.getMediaStream(capability);

      expect(stream).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          deviceId: { exact: 'cam1' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: false,
      });
    });

    it('should throw error when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const capability = {
        deviceId: 'cam1',
        label: 'Test Camera',
        width: 1920,
        height: 1080,
        frameRate: 30,
      };

      await expect(manager.getMediaStream(capability)).rejects.toThrow('Permission denied');
    });
  });
});
