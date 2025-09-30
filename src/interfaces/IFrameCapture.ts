/**
 * Interface for capturing video frames from a media stream
 */
export interface IFrameCaptureService {
  /**
   * Initialize the frame capture with a media stream
   */
  initialize(stream: MediaStream): Promise<void>;

  /**
   * Capture a single frame at the current moment
   */
  captureFrame(): Promise<VideoFrame>;

  /**
   * Cleanup resources
   */
  dispose(): void;
}
