import { IVideoEncoderService, IVideoEncoderConfig, IEncodedChunk } from '../interfaces/IVideoEncoder';
import { ILogger } from '../interfaces/ILogger';

/**
 * Encodes video frames using WebCodecs VideoEncoder
 * Implements Single Responsibility Principle - only handles video encoding
 */
export class VideoEncoderService implements IVideoEncoderService {
  private encoder: VideoEncoder | null = null;
  private encodedChunks: IEncodedChunk[] = [];

  constructor(private readonly logger: ILogger) {}

  async initialize(config: IVideoEncoderConfig): Promise<void> {
    this.logger.info('Initializing video encoder...', config);

    // Check codec support
    const support = await VideoEncoder.isConfigSupported({
      codec: config.codec,
      width: config.width,
      height: config.height,
      bitrate: config.bitrate,
      framerate: config.framerate,
    });

    if (!support.supported) {
      throw new Error(`Codec ${config.codec} is not supported`);
    }

    this.logger.debug('Codec support confirmed:', support.config);

    this.encodedChunks = [];

    // Create encoder with output callback
    this.encoder = new VideoEncoder({
      output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => {
        this.handleEncodedChunk(chunk, metadata);
      },
      error: (error: Error) => {
        this.logger.error('Encoder error', error);
      },
    });

    // Configure encoder
    this.encoder.configure({
      codec: config.codec,
      width: config.width,
      height: config.height,
      bitrate: config.bitrate,
      framerate: config.framerate,
      // Use low latency mode for real-time encoding
      latencyMode: 'realtime',
    });

    this.logger.debug('Video encoder initialized successfully');
  }

  private handleEncodedChunk(chunk: EncodedVideoChunk, _metadata?: EncodedVideoChunkMetadata): void {
    // Copy chunk data to ArrayBuffer (chunks are not transferable)
    const data = new ArrayBuffer(chunk.byteLength);
    chunk.copyTo(data);

    // Create a new EncodedVideoChunk from the copied data
    const copiedChunk = new EncodedVideoChunk({
      type: chunk.type,
      timestamp: chunk.timestamp,
      duration: chunk.duration || 0,
      data: data,
    });

    this.encodedChunks.push({
      data: copiedChunk,
      timestamp: chunk.timestamp,
      type: chunk.type,
    });

    this.logger.debug(
      `Encoded chunk ${this.encodedChunks.length}: type=${chunk.type}, timestamp=${chunk.timestamp}, size=${chunk.byteLength} bytes`
    );
  }

  async encodeFrame(frame: VideoFrame, keyFrame: boolean = false): Promise<void> {
    if (!this.encoder) {
      throw new Error('Encoder not initialized');
    }

    if (this.encoder.state !== 'configured') {
      throw new Error(`Encoder is in ${this.encoder.state} state`);
    }

    this.logger.debug(`Encoding frame: timestamp=${frame.timestamp}, keyFrame=${keyFrame}`);

    // Encode the frame
    this.encoder.encode(frame, { keyFrame });

    // Close the frame to free memory
    frame.close();
  }

  async flush(): Promise<void> {
    if (!this.encoder) {
      throw new Error('Encoder not initialized');
    }

    if (this.encoder.state !== 'configured') {
      throw new Error(`Cannot flush encoder in ${this.encoder.state} state`);
    }

    this.logger.info('Flushing encoder...');
    await this.encoder.flush();
    this.logger.debug(`Flush complete. Total encoded chunks: ${this.encodedChunks.length}`);
  }

  getEncodedChunks(): IEncodedChunk[] {
    return this.encodedChunks;
  }

  dispose(): void {
    this.logger.info('Disposing video encoder...');

    if (this.encoder) {
      if (this.encoder.state !== 'closed') {
        this.encoder.close();
      }
      this.encoder = null;
    }

    this.encodedChunks = [];
    this.logger.debug('Video encoder disposed');
  }
}
