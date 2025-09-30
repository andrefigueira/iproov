import { IEncodedChunk } from './IVideoEncoder';

/**
 * Interface for video decoding and playback
 */
export interface IVideoDecoderService {
  /**
   * Initialize decoder with codec configuration
   */
  initialize(codec: string, width: number, height: number): Promise<void>;

  /**
   * Decode chunks and render to canvas
   */
  decodeAndRender(chunks: IEncodedChunk[], canvas: HTMLCanvasElement): Promise<void>;

  /**
   * Cleanup decoder resources
   */
  dispose(): void;
}
