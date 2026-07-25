import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FaceMarkError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FaceMarkError';
  }
}

export class FaceService {
  private static adminToken: string | null = null;
  private static adminTokenExpiry: number = 0;

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

  private static async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.adminToken && now < this.adminTokenExpiry) {
      return this.adminToken;
    }

    const apiBase = this.getApiBase();
    const email = process.env.FACEMARK_ADMIN_EMAIL || 'admin@presentsir.com';
    const password = process.env.FACEMARK_ADMIN_PASSWORD || 'Admin@123';

    const url = `${apiBase}/api/auth/admin/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      console.error(`[FaceMark Admin Login Failure] Status: ${res.status}`);
      throw new FaceMarkError(
        'AUTHENTICATION_ERROR',
        'Face verification service authentication failed. Please check administrator credentials.'
      );
    }

    const data: any = await res.json();
    if (!data.access_token) {
      throw new FaceMarkError(
        'AUTHENTICATION_ERROR',
        'Face verification service authentication returned an invalid session token.'
      );
    }

    this.adminToken = data.access_token;
    this.adminTokenExpiry = now + 25 * 60 * 1000;
    return data.access_token;
  }

  private static handleFetchError(err: any): never {
    console.error('[FaceMark Fetch Error]:', err);
    const msg = err.message || '';
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new FaceMarkError(
        'NETWORK_ISSUE',
        'Unable to connect to the face verification service. Please check your internet connection and try again.'
      );
    }
    throw new FaceMarkError(
      'SERVER_ERROR',
      'Unable to process attendance right now. Please try again later.'
    );
  }

  private static async handleResponseError(response: Response, isEnroll = false): Promise<never> {
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

    if (isEnroll) {
      throw new FaceMarkError(
        'UNKNOWN_ERROR',
        'Something went wrong while registering your face. Please try again or contact the administrator if the problem continues.'
      );
    }

    throw new FaceMarkError(
      'SERVER_ERROR',
      'Unable to process attendance right now. Please try again later.'
    );
  }

  /**
   * Registers user face on the FaceMark staging server using register-multiple endpoint.
   * Preserved for Admin Portal enrollment features.
   */
  public static async enrollUserFaces(userId: string, images: Buffer[]): Promise<void> {
    if (images.length === 0) {
      throw new FaceMarkError(
        'INVALID_IMAGE',
        'The captured photo could not be processed. Please capture your face again.'
      );
    }

    const apiBase = this.getApiBase();
    let adminToken: string;
    try {
      adminToken = await this.getAdminToken();
    } catch (err: any) {
      if (err instanceof FaceMarkError) throw err;
      return this.handleFetchError(err);
    }

    const formData = new globalThis.FormData();
    for (let i = 0; i < images.length; i++) {
      const file = new globalThis.File([images[i]], `enroll_${i}.jpg`, { type: 'image/jpeg' });
      formData.append('files', file);
    }

    const url = `${apiBase}/api/face/register-multiple/${userId}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${adminToken}`
    };

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
      return this.handleResponseError(response, true);
    }
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
      return this.handleResponseError(response, false);
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
