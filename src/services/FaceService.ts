export class FaceMarkError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FaceMarkError';
  }
}

/**
 * Service for communicating exclusively with the FaceMark Quick Attendance API (POST /api/attendance/quick).
 */
export class FaceService {
  private static getApiBase(): string {
    return (process.env.FACEMARK_API_BASE || 'https://api.facemark.app.cloudshiftsolutions.in').replace(/\/$/, '');
  }

  private static getBearerToken(): string {
    return (
      process.env.FACEMARK_BEARER_TOKEN ||
      process.env.KIOSK_API_TOKEN ||
      process.env.FACEMARK_KIOSK_TOKEN ||
      process.env.VITE_KIOSK_TOKEN ||
      ''
    );
  }

  private static handleFetchError(err: any): never {
    console.error('[FaceMark Fetch Error]:', err);
    throw new FaceMarkError(
      'SERVER_ERROR',
      'Unable to process attendance right now. Please try again later.'
    );
  }

  private static async handleResponseError(response: Response): Promise<never> {
    const status = response.status;
    let errText = '';
    try {
      errText = await response.text();
    } catch (_) {}
    
    console.error(`[FaceMark API Error] Status: ${status}, Body: ${errText}`);

    const errLower = errText.toLowerCase();

    if (errLower.includes('multiple faces')) {
      throw new FaceMarkError(
        'MULTIPLE_FACES',
        'Multiple faces detected. Ensure only one face is visible.'
      );
    }

    if (
      errLower.includes('blurry') ||
      errLower.includes('quality') ||
      errLower.includes('poor image') ||
      errLower.includes('invalid image format') ||
      status === 422
    ) {
      throw new FaceMarkError(
        'POOR_IMAGE',
        'Image quality is too low. Move to better lighting and try again.'
      );
    }

    if (
      status === 404 ||
      errLower.includes('not recognized') ||
      errLower.includes('not detect') ||
      errLower.includes('no face') ||
      errLower.includes('face not found') ||
      errLower.includes('employee not found')
    ) {
      throw new FaceMarkError(
        'FACE_NOT_RECOGNIZED',
        'Unable to recognize your face. Please look at the camera clearly and try again.'
      );
    }

    throw new FaceMarkError(
      'SERVER_ERROR',
      'Unable to process attendance right now. Please try again later.'
    );
  }

  /**
   * Performs facial recognition using external FaceMark Quick Attendance API.
   * Path: POST /api/attendance/quick
   */
  public static async callQuickAttendanceApi(imageBuffer: Buffer): Promise<{ userId: string; confidence: number; action?: string }> {
    const apiBase = this.getApiBase();
    const token = this.getBearerToken();
    const formData = new globalThis.FormData();
    const file = new globalThis.File([imageBuffer], 'capture.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const url = `${apiBase}/api/attendance/quick`;
    const headers: Record<string, string> = {};
    if (token && token.trim().length > 0) {
      headers['X-Kiosk-Token'] = token;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers
      });
    } catch (err: any) {
      return this.handleFetchError(err);
    }

    if (!response.ok) {
      return this.handleResponseError(response);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (err) {
      throw new FaceMarkError(
        'SERVER_ERROR',
        'Unable to process attendance right now. Please try again later.'
      );
    }

    const recognizedId = data.userId || data.user_id || data.id || (data.user && (data.user.id || data.user.userId));
    const confidence = typeof data.confidence === 'number' ? data.confidence : (typeof data.similarity === 'number' ? data.similarity : 1.0);
    const action = data.action || data.status;

    if (!recognizedId) {
      throw new FaceMarkError(
        'FACE_NOT_RECOGNIZED',
        'Unable to recognize your face. Please look at the camera clearly and try again.'
      );
    }

    return {
      userId: recognizedId,
      confidence,
      action
    };
  }

  /**
   * Verifies if a captured face matches a target user ID using attendance/quick endpoint
   */
  public static async verifyUserFace(userId: string, imageBuffer: Buffer): Promise<{ isMatch: boolean; confidence: number }> {
    const match = await this.callQuickAttendanceApi(imageBuffer);
    const isMatch = match.userId.toLowerCase() === userId.toLowerCase();
    if (!isMatch) {
      throw new FaceMarkError(
        'FACE_NOT_RECOGNIZED',
        'Unable to recognize your face. Please look at the camera clearly and try again.'
      );
    }
    return {
      isMatch,
      confidence: match.confidence
    };
  }
}
