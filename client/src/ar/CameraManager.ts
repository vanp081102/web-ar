import type { ARSupportInfo } from '../types';

/**
 * Handles everything related to *browser capability* and *camera
 * permission* — separate from MindAR/Three.js so it can be unit-tested
 * and reused by the fallback screen.
 *
 * Note: MindAR internally calls getUserMedia itself when `.start()` is
 * invoked. This manager is used up-front to (a) verify the device/browser
 * can realistically support WebAR at all, and (b) drive the "Cho phép
 * Camera" permission UI *before* handing control to MindAR, since asking
 * twice (once here, once inside MindAR) would show two native prompts.
 * We therefore only do a capability probe here, not a real getUserMedia
 * call — the actual permission prompt happens once, inside ARManager.start().
 */
export class CameraManager {
  /**
   * Checks whether this browser exposes the minimum APIs required:
   * getUserMedia (WebRTC camera), WebGL (rendering), and WebAssembly /
   * Web Workers (MindAR's tracking engine runs on tfjs-backed workers).
   */
  static checkSupport(): ARSupportInfo {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { supported: false, reason: 'Trình duyệt không hỗ trợ truy cập Camera (getUserMedia).' };
    }

    if (!this.hasWebGL()) {
      return { supported: false, reason: 'Thiết bị không hỗ trợ WebGL.' };
    }

    if (typeof Worker === 'undefined') {
      return { supported: false, reason: 'Trình duyệt không hỗ trợ Web Worker.' };
    }

    if (typeof WebAssembly === 'undefined') {
      return { supported: false, reason: 'Trình duyệt không hỗ trợ WebAssembly.' };
    }

    return { supported: true };
  }

  private static hasWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    } catch {
      return false;
    }
  }

  /**
   * Maps a getUserMedia error thrown by MindAR/the browser to a
   * human-readable Vietnamese message for the permission-denied UI.
   */
  static describeError(error: unknown): string {
    const name = this.extractErrorName(error);
    const message = error instanceof Error ? error.message : String(error ?? '');

    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Bạn đã từ chối quyền truy cập Camera. Vui lòng cấp quyền trong Cài đặt Safari để tiếp tục.';
      case 'NotFoundError':
        return 'Không tìm thấy Camera trên thiết bị này.';
      case 'NotReadableError':
        return 'Camera đang được sử dụng bởi một ứng dụng khác.';
      case 'OverconstrainedError':
        return 'Không thể khởi tạo Camera với cấu hình yêu cầu.';
      case 'SecurityError':
        return 'Trình duyệt chặn Camera vì trang không chạy trên HTTPS. Hãy dùng HTTPS hoặc localhost.';
      default:
        if (/not allowed|permission|denied/i.test(message)) {
          return 'Bạn đã từ chối quyền truy cập Camera. Vui lòng cấp quyền trong Cài đặt Safari để tiếp tục.';
        }
        if (/https|secure context|insecure/i.test(message)) {
          return 'Trình duyệt chặn Camera vì trang không chạy trên HTTPS. Hãy dùng HTTPS hoặc localhost.';
        }
        if (message && message !== 'Đã xảy ra lỗi khi khởi tạo Camera. Vui lòng thử lại.') {
          return message;
        }
        return 'Đã xảy ra lỗi khi khởi tạo Camera. Vui lòng thử lại.';
    }
  }

  private static extractErrorName(error: unknown): string {
    if (error instanceof DOMException) return error.name;
    if (error instanceof Error && 'name' in error) return error.name;
    if (typeof error === 'object' && error !== null && 'name' in error) {
      return String((error as { name: unknown }).name);
    }
    return '';
  }
}
