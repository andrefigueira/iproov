/**
 * Encoded video chunk with metadata
 */
export interface IEncodedChunk {
  data: EncodedVideoChunk;
  timestamp: number;
  type: 'key' | 'delta';
}

/**
 * Video encoder configuration
 */
export interface IVideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
}

/**
 * Interface for video encoding operations
 */
export interface IVideoEncoderService {
  /**
   * Initialize the encoder with configuration
   */
  initialize(config: IVideoEncoderConfig): Promise<void>;

  /**
   * Encode a single video frame
   */
  encodeFrame(frame: VideoFrame, keyFrame?: boolean): Promise<void>;

  /**
   * Flush any pending encoded data
   */
  flush(): Promise<void>;

  /**
   * Get all encoded chunks
   */
  getEncodedChunks(): IEncodedChunk[];

  /**
   * Cleanup encoder resources
   */
  dispose(): void;
}
