import { IVideoDeviceManager, IVideoDeviceCapability } from '../interfaces/IVideoDevice';
import { ILogger } from '../interfaces/ILogger';

interface MediaTrackCapabilityRange {
  min?: number;
  max?: number;
}

interface VideoTrackCapabilities {
  width?: MediaTrackCapabilityRange;
  height?: MediaTrackCapabilityRange;
  frameRate?: MediaTrackCapabilityRange;
  facingMode?: string[];
}

/**
 * Manages video device enumeration and selection
 * Implements Single Responsibility Principle - only handles device management
 *
 * Production-optimized approach:
 * 1. Request permission once with facingMode constraint
 * 2. Enumerate devices (labels available after permission)
 * 3. Select best device based on labels and heuristics
 * 4. Get final stream with ideal constraints
 */
export class VideoDeviceManager implements IVideoDeviceManager {
  private permissionGranted: boolean = false;

  constructor(private readonly logger: ILogger) {}

  private async ensurePermission(): Promise<void> {
    if (this.permissionGranted) {
      return;
    }

    this.logger.info('Requesting camera permission...');

    try {
      // Request permission with user-facing preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      this.permissionGranted = true;
      this.logger.debug('Camera permission granted');
    } catch (error) {
      this.logger.error('Camera permission denied', error as Error);
      throw new Error('Camera permission denied. Please allow camera access to continue.');
    }
  }

  async getAvailableDevices(): Promise<IVideoDeviceCapability[]> {
    // Ensure permission is granted first
    await this.ensurePermission();

    this.logger.info('Enumerating video devices...');

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    this.logger.debug(`Found ${videoDevices.length} video devices`);

    // After permission, device labels are available
    const capabilities: IVideoDeviceCapability[] = videoDevices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
      // Use standard HD defaults - actual resolution will be negotiated by getUserMedia
      width: 1280,
      height: 720,
      frameRate: 30,
    }));

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
    const candidateCameras = realCameras.length > 0 ? realCameras : devices;

    // Prefer front-facing cameras based on label heuristics
    const frontFacingKeywords = ['front', 'user', 'facetime', 'webcam', 'integrated'];
    const frontCameras = candidateCameras.filter((device) => {
      const lowerLabel = device.label.toLowerCase();
      return frontFacingKeywords.some((keyword) => lowerLabel.includes(keyword));
    });

    // Use front-facing if found, otherwise use first available
    const best = frontCameras.length > 0 ? frontCameras[0] : candidateCameras[0];

    this.logger.info(`Selected best device: ${best.label}`);

    return best;
  }

  async getMediaStream(capability: IVideoDeviceCapability): Promise<MediaStream> {
    this.logger.info(`Requesting media stream for device: ${capability.label}`);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: capability.deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();

    this.logger.debug(
      `Media stream acquired: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`
    );

    return stream;
  }
}
