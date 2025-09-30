import { IFrameCaptureService } from '../interfaces/IFrameCapture';
import { ILogger } from '../interfaces/ILogger';

// Type definition for MediaStreamTrackProcessor (experimental API)
declare class MediaStreamTrackProcessor<T = VideoFrame> {
  constructor(init: { track: MediaStreamTrack });
  readonly readable: ReadableStream<T>;
}

/**
 * Captures individual frames from a MediaStream using MediaStreamTrackProcessor
 * Implements Single Responsibility Principle - only handles frame extraction
 */
export class FrameCaptureService implements IFrameCaptureService {
  private static readonly FIRST_FRAME_TIMEOUT_MS = 5000;
  private static readonly FIRST_FRAME_POLL_INTERVAL_MS = 50;

  private videoTrack: MediaStreamTrack | null = null;
  private processor: MediaStreamTrackProcessor<VideoFrame> | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private currentFrame: VideoFrame | null = null;
  private isReading: boolean = false;
  private frameUpdateLock: Promise<void> = Promise.resolve();

  constructor(private readonly logger: ILogger) {}

  async initialize(stream: MediaStream): Promise<void> {
    this.logger.info('Initializing frame capture service...');

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error('No video tracks found in media stream');
    }

    this.videoTrack = videoTracks[0];

    // Use MediaStreamTrackProcessor for frame extraction
    this.processor = new MediaStreamTrackProcessor({ track: this.videoTrack });
    this.reader = this.processor.readable.getReader();

    // Start reading frames continuously
    this.isReading = true;
    this.readFrames();

    // Wait for first frame to be available
    await this.waitForFirstFrame();

    this.logger.debug('Frame capture service initialized');
  }

  private async waitForFirstFrame(): Promise<void> {
    const startTime = Date.now();

    while (!this.currentFrame && Date.now() - startTime < FrameCaptureService.FIRST_FRAME_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, FrameCaptureService.FIRST_FRAME_POLL_INTERVAL_MS));
    }

    if (!this.currentFrame) {
      throw new Error('Timeout waiting for first frame');
    }

    this.logger.debug('First frame ready');
  }

  private async readFrames(): Promise<void> {
    while (this.isReading && this.reader) {
      try {
        const { done, value } = await this.reader.read();

        if (done) {
          break;
        }

        // Wait for any pending frame captures to complete
        await this.frameUpdateLock;

        // Close previous frame to avoid memory leaks
        if (this.currentFrame) {
          this.currentFrame.close();
        }

        this.currentFrame = value;
      } catch (error) {
        if (this.isReading) {
          this.logger.error('Error reading frame', error as Error);
        }
        break;
      }
    }
  }

  async captureFrame(): Promise<VideoFrame> {
    if (!this.currentFrame) {
      throw new Error('No frame available to capture');
    }

    // Create a lock to prevent frame updates during cloning
    let releaseLock: () => void;
    this.frameUpdateLock = new Promise((resolve) => {
      releaseLock = resolve;
    });

    try {
      // Clone the frame so the original can continue to be updated
      const clonedFrame = this.currentFrame.clone();
      this.logger.debug(`Captured frame at timestamp ${clonedFrame.timestamp}`);

      return clonedFrame;
    } finally {
      // Release the lock
      releaseLock!();
    }
  }

  dispose(): void {
    this.logger.info('Disposing frame capture service...');

    this.isReading = false;

    if (this.reader) {
      this.reader.cancel();
      this.reader = null;
    }

    if (this.currentFrame) {
      this.currentFrame.close();
      this.currentFrame = null;
    }

    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }

    this.processor = null;
    this.logger.debug('Frame capture service disposed');
  }
}
