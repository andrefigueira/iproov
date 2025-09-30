import { IVideoDeviceManager } from '../interfaces/IVideoDevice';
import { IFrameCaptureService } from '../interfaces/IFrameCapture';
import { IScreenFlashController, FlashColor } from '../interfaces/IScreenFlash';
import { IVideoEncoderService } from '../interfaces/IVideoEncoder';
import { IVideoDecoderService } from '../interfaces/IVideoDecoder';
import { IFaceDetectionService, IFaceDetectionResult } from '../interfaces/IFaceDetection';
import { ILogger } from '../interfaces/ILogger';

/**
 * Orchestrates the entire WebCodecs workflow
 * Implements Dependency Inversion Principle - depends on abstractions, not concretions
 * Implements Open/Closed Principle - extensible through dependency injection
 */
export class WebCodecsOrchestrator {
  private static readonly FLASH_PATTERN = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
  private static readonly TOTAL_DURATION_MS = 10000;
  private static readonly FRAME_COUNT = 20;
  private static readonly FRAME_INTERVAL_MS = WebCodecsOrchestrator.TOTAL_DURATION_MS / WebCodecsOrchestrator.FRAME_COUNT;
  private static readonly FLASH_DISPLAY_DELAY_MS = 50;
  private static readonly VALIDATION_FRAME_SAMPLING_RATE = 5;

  private mediaStream: MediaStream | null = null;
  private validationResults: IFaceDetectionResult[] = [];
  private capturedFramesForValidation: VideoFrame[] = [];

  constructor(
    private readonly deviceManager: IVideoDeviceManager,
    private readonly frameCaptureService: IFrameCaptureService,
    private readonly flashController: IScreenFlashController,
    private readonly encoderService: IVideoEncoderService,
    private readonly decoderService: IVideoDecoderService,
    private readonly faceDetectionService: IFaceDetectionService | null,
    private readonly logger: ILogger
  ) {}

  /**
   * Main workflow execution
   */
  async execute(
    outputCanvas: HTMLCanvasElement,
    onProgress?: (progress: number, status?: string) => void,
    previewVideo?: HTMLVideoElement,
    onValidation?: (results: IFaceDetectionResult[]) => void
  ): Promise<void> {
    try {
      this.logger.info('Starting WebCodecs workflow...');

      // Step 1: Initialize camera
      onProgress?.(0, 'Initializing camera...');
      await this.initializeCamera(previewVideo);
      onProgress?.(10, 'Camera ready');

      // Step 2: Initialize encoder
      onProgress?.(10, 'Setting up video encoder...');
      await this.initializeEncoder();
      onProgress?.(20, 'Encoder ready');

      // Step 3: Capture and encode frames with flashing
      onProgress?.(20, 'Capturing frames (0/20)...');
      await this.captureAndEncodeFrames(onProgress);
      onProgress?.(70, 'All frames captured and encoded');

      // Step 4: Decode and render
      onProgress?.(70, 'Decoding and rendering video...');
      await this.decodeAndRender(outputCanvas);
      onProgress?.(80, 'Video playback complete');

      // Step 5: Validate frames (after capture, at the end)
      if (this.faceDetectionService) {
        onProgress?.(80, 'Validating frames with AI...');
        await this.validateCapturedFrames();
        if (onValidation && this.validationResults.length > 0) {
          onValidation(this.validationResults);
        }
        onProgress?.(90, 'Validation complete');
      } else {
        onProgress?.(90, 'Skipping validation');
      }

      // Step 6: Cleanup
      onProgress?.(90, 'Cleaning up resources...');
      await this.cleanup();
      onProgress?.(100, 'Complete!');

      this.logger.info('WebCodecs workflow completed successfully');
    } catch (error) {
      this.logger.error('Workflow failed', error as Error);
      await this.cleanup();
      throw error;
    }
  }

  getValidationResults(): IFaceDetectionResult[] {
    return this.validationResults;
  }

  private async initializeCamera(previewVideo?: HTMLVideoElement): Promise<void> {
    this.logger.info('Initializing camera...');

    // Get best available device
    const device = await this.deviceManager.getBestDevice();

    // Get media stream
    this.mediaStream = await this.deviceManager.getMediaStream(device);

    // Show preview if video element provided
    if (previewVideo && this.mediaStream) {
      previewVideo.srcObject = this.mediaStream;
      previewVideo.style.display = 'block';
    }

    // Initialize frame capture
    await this.frameCaptureService.initialize(this.mediaStream);

    this.logger.info('Camera initialized successfully');
  }

  private async initializeEncoder(): Promise<void> {
    this.logger.info('Initializing encoder...');

    if (!this.mediaStream) {
      throw new Error('Media stream not initialized');
    }

    const videoTrack = this.mediaStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();

    await this.encoderService.initialize({
      codec: 'vp8', // VP8 has good browser support
      width: settings.width || 1280,
      height: settings.height || 720,
      bitrate: 2_000_000, // 2 Mbps
      framerate: 30,
    });

    this.logger.info('Encoder initialized successfully');
  }

  private async captureAndEncodeFrames(onProgress?: (progress: number, status?: string) => void): Promise<void> {
    this.logger.info(
      `Capturing and encoding ${WebCodecsOrchestrator.FRAME_COUNT} frames over ${WebCodecsOrchestrator.TOTAL_DURATION_MS}ms...`
    );

    this.flashController.show();
    this.capturedFramesForValidation = [];

    for (let i = 0; i < WebCodecsOrchestrator.FRAME_COUNT; i++) {
      const flashColor = WebCodecsOrchestrator.FLASH_PATTERN[i] === 0 ? FlashColor.BLACK : FlashColor.WHITE;

      // Set flash color
      this.flashController.setColor(flashColor);

      // Wait a moment for the flash to be visible in the camera
      await this.sleep(WebCodecsOrchestrator.FLASH_DISPLAY_DELAY_MS);

      // Capture frame
      const frame = await this.frameCaptureService.captureFrame();

      // Store frame for validation later (only every Nth frame to save API calls)
      if (this.faceDetectionService && i % WebCodecsOrchestrator.VALIDATION_FRAME_SAMPLING_RATE === 0) {
        this.capturedFramesForValidation.push(frame.clone());
      }

      // Encode frame (first frame as keyframe)
      await this.encoderService.encodeFrame(frame, i === 0);

      this.logger.info(`Frame ${i + 1}/${WebCodecsOrchestrator.FRAME_COUNT} captured and encoded (color: ${flashColor})`);

      // Update progress (from 20% to 70%)
      const progress = 20 + ((i + 1) / WebCodecsOrchestrator.FRAME_COUNT) * 50;
      const colorName = flashColor === FlashColor.BLACK ? 'black' : 'white';
      onProgress?.(Math.round(progress), `Capturing frame ${i + 1}/20 (${colorName} flash)...`);

      // Wait for next frame interval (minus the delay we already waited)
      if (i < WebCodecsOrchestrator.FRAME_COUNT - 1) {
        await this.sleep(WebCodecsOrchestrator.FRAME_INTERVAL_MS - WebCodecsOrchestrator.FLASH_DISPLAY_DELAY_MS);
      }
    }

    this.flashController.hide();

    // Flush encoder to ensure all frames are encoded
    onProgress?.(70, 'Flushing encoder...');
    await this.encoderService.flush();

    this.logger.info('All frames captured and encoded');
  }

  private async validateCapturedFrames(): Promise<void> {
    if (!this.faceDetectionService || this.capturedFramesForValidation.length === 0) {
      return;
    }

    this.logger.info(`Validating ${this.capturedFramesForValidation.length} frames...`);
    this.validationResults = [];

    for (let i = 0; i < this.capturedFramesForValidation.length; i++) {
      const frame = this.capturedFramesForValidation[i];
      const validationResult = await this.faceDetectionService.analyzeFrame(frame);
      this.validationResults.push(validationResult);

      this.logger.info(
        `Frame ${i * WebCodecsOrchestrator.VALIDATION_FRAME_SAMPLING_RATE + 1} validation: valid=${validationResult.isValid}, face=${validationResult.hasFace}, facing=${validationResult.isFacingCamera}`
      );

      frame.close();
    }

    this.capturedFramesForValidation = [];
    this.logger.info('Validation complete');
  }

  private async decodeAndRender(canvas: HTMLCanvasElement): Promise<void> {
    this.logger.info('Decoding and rendering frames...');

    const encodedChunks = this.encoderService.getEncodedChunks();

    if (encodedChunks.length === 0) {
      throw new Error('No encoded chunks available');
    }

    this.logger.info(`Rendering ${encodedChunks.length} encoded chunks`);

    if (!this.mediaStream) {
      throw new Error('Media stream not initialized');
    }

    const videoTrack = this.mediaStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();

    await this.decoderService.initialize(
      'vp8',
      settings.width || 1280,
      settings.height || 720
    );

    await this.decoderService.decodeAndRender(encodedChunks, canvas);

    this.logger.info('Frames decoded and rendered successfully');
  }

  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resources...');

    // Dispose services
    this.frameCaptureService.dispose();
    this.encoderService.dispose();
    this.decoderService.dispose();
    this.flashController.dispose();

    // Clean up captured frames for validation
    for (const frame of this.capturedFramesForValidation) {
      frame.close();
    }
    this.capturedFramesForValidation = [];

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.logger.info('Cleanup complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
