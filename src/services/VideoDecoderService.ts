import { IVideoDecoderService } from '../interfaces/IVideoDecoder';
import { IEncodedChunk } from '../interfaces/IVideoEncoder';
import { ILogger } from '../interfaces/ILogger';

/**
 * Decodes video chunks and renders them to a canvas
 * Implements Single Responsibility Principle - only handles video decoding and rendering
 */
export class VideoDecoderService implements IVideoDecoderService {
  private static readonly FRAME_PLAYBACK_INTERVAL_MS = 500;

  private decoder: VideoDecoder | null = null;
  private decodedFrames: VideoFrame[] = [];

  constructor(private readonly logger: ILogger) {}

  async initialize(codec: string, width: number, height: number): Promise<void> {
    this.logger.info(`Initializing video decoder with codec: ${codec}`);

    // Check codec support
    const support = await VideoDecoder.isConfigSupported({
      codec: codec,
      codedWidth: width,
      codedHeight: height,
    });

    if (!support.supported) {
      throw new Error(`Decoder codec ${codec} is not supported`);
    }

    this.logger.debug('Decoder codec support confirmed');

    this.decodedFrames = [];

    // Create decoder with output callback
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        this.decodedFrames.push(frame);
        this.logger.debug(`Decoded frame ${this.decodedFrames.length}: timestamp=${frame.timestamp}`);
      },
      error: (error: Error) => {
        this.logger.error('Decoder error', error);
      },
    });

    // Configure decoder
    this.decoder.configure({
      codec: codec,
      codedWidth: width,
      codedHeight: height,
    });

    this.logger.debug('Video decoder initialized successfully');
  }

  async decodeAndRender(chunks: IEncodedChunk[], canvas: HTMLCanvasElement): Promise<void> {
    if (!this.decoder) {
      throw new Error('Decoder not initialized');
    }

    this.logger.info(`Decoding and rendering ${chunks.length} chunks...`);

    // Decode all chunks
    for (const chunk of chunks) {
      this.decoder.decode(chunk.data);
    }

    // Wait for all frames to be decoded
    await this.decoder.flush();

    this.logger.debug(`Decoded ${this.decodedFrames.length} frames`);

    // Render frames to canvas with timing
    await this.renderFrames(canvas);
  }

  private async renderFrames(canvas: HTMLCanvasElement): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    if (this.decodedFrames.length === 0) {
      this.logger.warn('No frames to render');
      return;
    }

    // Set canvas size to match video
    const firstFrame = this.decodedFrames[0];
    canvas.width = firstFrame.displayWidth;
    canvas.height = firstFrame.displayHeight;

    this.logger.info(`Rendering ${this.decodedFrames.length} frames to canvas...`);

    for (let i = 0; i < this.decodedFrames.length; i++) {
      const frame = this.decodedFrames[i];

      // Draw frame to canvas
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

      this.logger.debug(`Rendered frame ${i + 1}/${this.decodedFrames.length}`);

      // Wait for frame interval before showing next frame (except for last frame)
      if (i < this.decodedFrames.length - 1) {
        await this.sleep(VideoDecoderService.FRAME_PLAYBACK_INTERVAL_MS);
      }

      // Close frame after rendering to free memory
      frame.close();
    }

    this.decodedFrames = [];
    this.logger.info('Frame rendering complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.logger.info('Disposing video decoder...');

    // Close any remaining frames
    for (const frame of this.decodedFrames) {
      frame.close();
    }
    this.decodedFrames = [];

    if (this.decoder) {
      if (this.decoder.state !== 'closed') {
        this.decoder.close();
      }
      this.decoder = null;
    }

    this.logger.debug('Video decoder disposed');
  }
}
