/**
 * Face detection result
 */
export interface IFaceDetectionResult {
  isValid: boolean;
  hasFace: boolean;
  isFacingCamera: boolean;
  wearingGlasses: boolean;
  wearingHeadwear: boolean;
  confidence: number;
  reason?: string;
}

/**
 * Interface for face detection service
 */
export interface IFaceDetectionService {
  /**
   * Analyze a video frame for face presence and orientation
   */
  analyzeFrame(frame: VideoFrame): Promise<IFaceDetectionResult>;

  /**
   * Set the OpenAI API key
   */
  setApiKey(apiKey: string): void;
}
