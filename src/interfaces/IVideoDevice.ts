/**
 * Represents a video input device capability
 */
export interface IVideoDeviceCapability {
  deviceId: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * Interface for video device management
 */
export interface IVideoDeviceManager {
  /**
   * Get all available video devices with their capabilities
   */
  getAvailableDevices(): Promise<IVideoDeviceCapability[]>;

  /**
   * Get the best available device based on resolution
   */
  getBestDevice(): Promise<IVideoDeviceCapability>;

  /**
   * Request media stream for a specific device
   */
  getMediaStream(capability: IVideoDeviceCapability): Promise<MediaStream>;
}
