import { IVideoDeviceManager, IVideoDeviceCapability } from '../interfaces/IVideoDevice';
import { ILogger } from '../interfaces/ILogger';

/**
 * Manages video device enumeration and selection
 * Implements Single Responsibility Principle - only handles device management
 */
export class VideoDeviceManager implements IVideoDeviceManager {
  constructor(private readonly logger: ILogger) {}

  async getAvailableDevices(): Promise<IVideoDeviceCapability[]> {
    this.logger.info('Enumerating video devices...');

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    this.logger.debug(`Found ${videoDevices.length} video devices`);

    const capabilities: IVideoDeviceCapability[] = [];

    for (const device of videoDevices) {
      try {
        // Request a test stream to get capabilities
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: device.deviceId },
          },
        });

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        interface MediaTrackCapabilityRange {
          min?: number;
          max?: number;
        }

        interface VideoTrackCapabilities {
          width?: MediaTrackCapabilityRange;
          height?: MediaTrackCapabilityRange;
          frameRate?: MediaTrackCapabilityRange;
        }

        const trackCapabilities = track.getCapabilities() as VideoTrackCapabilities;

        const width = settings.width || trackCapabilities.width?.max || 1920;
        const height = settings.height || trackCapabilities.height?.max || 1080;
        const frameRate = settings.frameRate || trackCapabilities.frameRate?.max || 30;

        // Validate dimensions
        if (width <= 0 || height <= 0 || frameRate <= 0) {
          this.logger.warn(`Invalid capabilities for device ${device.deviceId}, skipping`);
          continue;
        }

        capabilities.push({
          deviceId: device.deviceId,
          label: device.label || `Camera ${capabilities.length + 1}`,
          width,
          height,
          frameRate,
        });

        // Clean up test stream
        stream.getTracks().forEach((t) => t.stop());
      } catch (error) {
        this.logger.warn(`Failed to get capabilities for device ${device.deviceId}`, error);
      }
    }

    return capabilities;
  }

  async getBestDevice(): Promise<IVideoDeviceCapability> {
    const devices = await this.getAvailableDevices();

    if (devices.length === 0) {
      throw new Error('No video devices available');
    }

    // Filter out virtual cameras (OBS, Snap Camera, etc.)
    const virtualCameraKeywords = ['obs', 'virtual', 'snap', 'xsplit', 'streamlabs', 'camera hub'];
    const realCameras = devices.filter((device) => {
      const lowerLabel = device.label.toLowerCase();
      return !virtualCameraKeywords.some((keyword) => lowerLabel.includes(keyword));
    });

    // Use real cameras if available, otherwise fall back to all devices
    const camerasToSort = realCameras.length > 0 ? realCameras : devices;

    // Sort by resolution (width * height) descending
    camerasToSort.sort((a, b) => b.width * b.height - a.width * a.height);

    const best = camerasToSort[0];
    this.logger.info(
      `Selected best device: ${best.label} (${best.width}x${best.height} @ ${best.frameRate}fps)`
    );

    return best;
  }

  async getMediaStream(capability: IVideoDeviceCapability): Promise<MediaStream> {
    this.logger.info(`Requesting media stream for device: ${capability.label}`);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: capability.deviceId },
        width: { ideal: capability.width },
        height: { ideal: capability.height },
        frameRate: { ideal: capability.frameRate },
        facingMode: 'user', // Prefer front-facing camera
      },
      audio: false,
    });

    this.logger.debug('Media stream acquired successfully');
    return stream;
  }
}
