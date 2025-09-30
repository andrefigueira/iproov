import { IFaceDetectionService, IFaceDetectionResult } from '../interfaces/IFaceDetection';
import { ILogger } from '../interfaces/ILogger';

/**
 * Face detection using OpenAI Vision API
 * Implements Single Responsibility Principle - only handles face detection
 */
export class OpenAIFaceDetectionService implements IFaceDetectionService {
  private static readonly API_TIMEOUT_MS = 30000;
  private static readonly API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  private apiKey: string = '';

  constructor(private readonly logger: ILogger) {}

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.logger.debug('OpenAI API key set');
  }

  async analyzeFrame(frame: VideoFrame): Promise<IFaceDetectionResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    try {
      this.logger.debug('Analyzing frame for face detection...');

      // Convert VideoFrame to base64 image
      const base64Image = await this.videoFrameToBase64(frame);

      // Call OpenAI Vision API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OpenAIFaceDetectionService.API_TIMEOUT_MS);

      try {
        const response = await fetch(OpenAIFaceDetectionService.API_ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image and respond ONLY with a JSON object (no markdown, no code blocks). Determine: 1) Is there a human face clearly visible? 2) Is the person generally facing toward the camera (even if slightly angled, as long as eyes and main facial features are visible)? Be lenient - if you can see the face front-on or at a slight angle, consider it facing the camera. 3) Is the person wearing glasses or eyewear? 4) Is the person wearing any headwear (hat, cap, hood, headscarf, etc.)? 5) Confidence level (0-1). Format: {"hasFace": boolean, "isFacingCamera": boolean, "wearingGlasses": boolean, "wearingHeadwear": boolean, "confidence": number, "reason": "brief explanation"}',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      this.logger.debug('OpenAI response:', content);

      // Parse JSON response with error handling
      let result: unknown;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI response as JSON: ${content.substring(0, 100)}`);
      }

      // Validate response structure
      if (typeof result !== 'object' || result === null) {
        throw new Error('OpenAI returned invalid response format (not an object)');
      }

      const response_data = result as Record<string, unknown>;

      if (
        typeof response_data.hasFace !== 'boolean' ||
        typeof response_data.isFacingCamera !== 'boolean' ||
        typeof response_data.confidence !== 'number'
      ) {
        throw new Error(
          'OpenAI response missing required fields (hasFace, isFacingCamera, confidence)'
        );
      }

      const detectionResult: IFaceDetectionResult = {
        hasFace: response_data.hasFace,
        isFacingCamera: response_data.isFacingCamera,
        wearingGlasses: typeof response_data.wearingGlasses === 'boolean' ? response_data.wearingGlasses : false,
        wearingHeadwear: typeof response_data.wearingHeadwear === 'boolean' ? response_data.wearingHeadwear : false,
        confidence: Math.max(0, Math.min(1, response_data.confidence)),
        isValid: response_data.hasFace && response_data.isFacingCamera,
        reason: typeof response_data.reason === 'string' ? response_data.reason : 'No reason provided',
      };

      this.logger.info(
        `Face detection: hasFace=${detectionResult.hasFace}, facing=${detectionResult.isFacingCamera}, glasses=${detectionResult.wearingGlasses}, headwear=${detectionResult.wearingHeadwear}, confidence=${detectionResult.confidence}`
      );

        return detectionResult;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      this.logger.error('Face detection failed', error as Error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 30 seconds');
      }

      // Distinguish between error types for better user feedback
      if (errorMessage.includes('API key') || errorMessage.includes('Unauthorized')) {
        throw new Error('Invalid or missing OpenAI API key. Please check your API key.');
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
      }

      // For other errors, return uncertain result but log clearly
      return {
        isValid: false,
        hasFace: false,
        isFacingCamera: false,
        wearingGlasses: false,
        wearingHeadwear: false,
        confidence: 0,
        reason: `Analysis failed: ${errorMessage}`,
      };
    }
  }

  private async videoFrameToBase64(frame: VideoFrame): Promise<string> {
    // Create canvas to draw frame
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw frame to canvas
    ctx.drawImage(frame, 0, 0);

    // Convert to blob
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuffer);

    return base64;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
