import { ConsoleLogger } from './services/Logger';
import { VideoDeviceManager } from './services/VideoDeviceManager';
import { FrameCaptureService } from './services/FrameCaptureService';
import { ScreenFlashController } from './services/ScreenFlashController';
import { VideoEncoderService } from './services/VideoEncoderService';
import { VideoDecoderService } from './services/VideoDecoderService';
import { OpenAIFaceDetectionService } from './services/OpenAIFaceDetectionService';
import { WebCodecsOrchestrator } from './orchestrator/WebCodecsOrchestrator';
import { LogLevel } from './interfaces/ILogger';
import { IFaceDetectionResult } from './interfaces/IFaceDetection';

/**
 * Main application entry point
 * Demonstrates Dependency Injection and composition of services
 */
class Application {
  private orchestrator: WebCodecsOrchestrator | null = null;
  private startButton: HTMLButtonElement | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private previewVideo: HTMLVideoElement | null = null;
  private progressBar: HTMLDivElement | null = null;
  private progressText: HTMLDivElement | null = null;
  private statusText: HTMLDivElement | null = null;
  private logger = new ConsoleLogger('Application', LogLevel.DEBUG);

  async initialize(): Promise<void> {
    this.logger.info('Initializing application...');

    // Get UI elements
    const startButton = document.getElementById('start-btn');
    const outputCanvas = document.getElementById('output-canvas');
    const previewVideo = document.getElementById('preview-video');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const statusText = document.getElementById('status-text');

    if (!startButton || !(startButton instanceof HTMLButtonElement)) {
      throw new Error('Start button not found or invalid');
    }
    if (!outputCanvas || !(outputCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Output canvas not found or invalid');
    }
    if (previewVideo && !(previewVideo instanceof HTMLVideoElement)) {
      throw new Error('Preview video element invalid');
    }
    if (progressBar && !(progressBar instanceof HTMLDivElement)) {
      throw new Error('Progress bar element invalid');
    }
    if (progressText && !(progressText instanceof HTMLDivElement)) {
      throw new Error('Progress text element invalid');
    }
    if (statusText && !(statusText instanceof HTMLDivElement)) {
      throw new Error('Status text element invalid');
    }

    this.startButton = startButton;
    this.outputCanvas = outputCanvas;
    this.previewVideo = previewVideo || null;
    this.progressBar = progressBar || null;
    this.progressText = progressText || null;
    this.statusText = statusText || null;

    // Check WebCodecs support
    if (!this.checkWebCodecsSupport()) {
      this.updateStatus('WebCodecs is not supported in this browser. Please use Chrome.', 'error');
      this.startButton.disabled = true;
      return;
    }

    // Setup event listeners
    this.startButton.addEventListener('click', () => this.start());

    this.updateStatus('Ready to start. Click the button to begin.', 'ready');
    this.logger.info('Application initialized successfully');
  }

  private checkWebCodecsSupport(): boolean {
    return (
      typeof VideoEncoder !== 'undefined' &&
      typeof VideoDecoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined' &&
      typeof MediaStreamTrackProcessor !== 'undefined'
    );
  }

  private async start(): Promise<void> {
    if (!this.startButton || !this.outputCanvas) {
      return;
    }

    try {
      this.startButton.disabled = true;
      this.updateStatus('Initializing services...', 'processing');
      this.updateProgress(0);

      // Get OpenAI API key from environment or prompt
      let apiKey = import.meta.env.VITE_OPENAI_API_KEY;

      if (!apiKey) {
        apiKey = prompt('Enter your OpenAI API key (optional, leave blank to skip face detection):');
      }

      // Create services with dependency injection
      const logger = new ConsoleLogger('WebCodecs', LogLevel.DEBUG);
      const deviceManager = new VideoDeviceManager(logger);
      const frameCaptureService = new FrameCaptureService(logger);
      const flashController = new ScreenFlashController(logger);
      const encoderService = new VideoEncoderService(logger);
      const decoderService = new VideoDecoderService(logger);

      // Create face detection service if API key provided
      let faceDetectionService = null;
      if (apiKey && apiKey.trim()) {
        faceDetectionService = new OpenAIFaceDetectionService(logger);
        faceDetectionService.setApiKey(apiKey.trim());
        this.logger.info('Face detection enabled');
      } else {
        this.logger.info('Face detection disabled');
      }

      // Create orchestrator
      this.orchestrator = new WebCodecsOrchestrator(
        deviceManager,
        frameCaptureService,
        flashController,
        encoderService,
        decoderService,
        faceDetectionService,
        logger
      );

      // Execute workflow
      await this.orchestrator.execute(
        this.outputCanvas,
        (progress, status) => {
          this.updateProgress(progress);
          if (status) {
            this.updateStatus(status, 'processing');
          }
        },
        this.previewVideo || undefined,
        (results) => {
          this.displayValidationResults(results);
        }
      );

      this.updateStatus('Workflow completed successfully!', 'success');
    } catch (error) {
      this.logger.error('Workflow failed', error as Error);
      this.updateStatus(`Error: ${(error as Error).message}`, 'error');
    } finally {
      if (this.startButton) {
        this.startButton.disabled = false;
      }
    }
  }

  private displayValidationResults(results: IFaceDetectionResult[]): void {
    const validationResults = document.getElementById('validation-results');
    const validationSummary = document.getElementById('validation-summary');
    const validationDetails = document.getElementById('validation-details');

    if (!validationResults || !validationSummary || !validationDetails) {
      return;
    }

    // Show validation section
    validationResults.style.display = 'block';

    // Calculate summary
    const validCount = results.filter((r) => r.isValid).length;
    const totalCount = results.length;
    const validPercentage = Math.round((validCount / totalCount) * 100);

    // Set summary
    let summaryClass = 'valid';
    let summaryText = `✓ All frames valid (${validCount}/${totalCount})`;

    if (validCount === 0) {
      summaryClass = 'invalid';
      summaryText = `✗ No valid frames detected (${validCount}/${totalCount})`;
    } else if (validCount < totalCount) {
      summaryClass = 'partial';
      summaryText = `⚠ ${validPercentage}% valid frames (${validCount}/${totalCount})`;
    }

    validationSummary.className = `validation-summary ${summaryClass}`;
    validationSummary.textContent = summaryText;

    // Display details
    validationDetails.innerHTML = results
      .map(
        (result, index) => `
      <div class="validation-item">
        <span class="label">Frame ${index * 5 + 1}:</span>
        <div>
          <span class="value ${result.hasFace ? 'valid' : 'invalid'}">
            ${result.hasFace ? '✓ Face' : '✗ No Face'}
          </span>
          <span class="value ${result.isFacingCamera ? 'valid' : 'invalid'}">
            ${result.isFacingCamera ? '✓ Facing' : '✗ Not Facing'}
          </span>
          <span class="value ${result.wearingGlasses ? 'invalid' : 'valid'}">
            ${result.wearingGlasses ? '👓 Glasses' : '✓ No Glasses'}
          </span>
          <span class="value ${result.wearingHeadwear ? 'invalid' : 'valid'}">
            ${result.wearingHeadwear ? '🧢 Headwear' : '✓ No Headwear'}
          </span>
          <span class="value">(${Math.round(result.confidence * 100)}%)</span>
        </div>
      </div>
    `
      )
      .join('');

    this.logger.info(`Validation results displayed: ${validCount}/${totalCount} valid`);
  }

  private updateProgress(progress: number): void {
    if (this.progressBar && this.progressText) {
      this.progressBar.style.width = `${progress}%`;
      this.progressText.textContent = `${Math.round(progress)}%`;
    }
  }

  private updateStatus(message: string, type: 'ready' | 'processing' | 'success' | 'error'): void {
    if (!this.statusText) {
      return;
    }

    this.statusText.textContent = message;
    this.statusText.className = `status-text status-${type}`;
    this.logger.info(`Status: ${message}`);
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const logger = new ConsoleLogger('Bootstrap', LogLevel.ERROR);
  const app = new Application();
  try {
    await app.initialize();
  } catch (error) {
    logger.error('Failed to initialize application', error as Error);
  }
});
