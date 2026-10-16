import crypto from 'node:crypto';

export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const MAX_ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6 hours
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Generate a cryptographically secure 6-digit numeric room code (e.g. "482910")
 */
export function generateRoomCode(): string {
  // Generate random integer in [100000, 999999]
  const min = 100000;
  const max = 999999;
  const range = max - min + 1;
  const randNum = crypto.randomInt(0, range);
  return String(min + randNum);
}

/**
 * Generate a cryptographically random room ID (UUID v4 or hex)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Sanitize filename to prevent directory traversal, control characters, and header injections.
 * Preserves unicode characters and spaces safely.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'unnamed-file';
  }

  // Strip path traversal prefixes like C:\ or ../ or /
  let cleaned = rawName.replace(/^.*[\\/]/, '');

  // Strip null bytes and control chars (ASCII 0-31 and 127)
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  // Disallow double dots that could be interpreted as parent folder
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // Strip leading dots to prevent hidden files
  cleaned = cleaned.replace(/^\.+/, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Limit filename length to 200 characters to prevent buffer issues
  if (cleaned.length > 200) {
    const extIndex = cleaned.lastIndexOf('.');
    if (extIndex > 0 && cleaned.length - extIndex <= 10) {
      const ext = cleaned.slice(extIndex);
      cleaned = cleaned.slice(0, 190) + ext;
    } else {
      cleaned = cleaned.slice(0, 200);
    }
  }

  return cleaned.length > 0 ? cleaned : 'unnamed-file';
}

/**
 * Formats byte size into human readable string (e.g., "12.4 MB")
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Check if a room has expired based on inactivity or absolute max lifetime
 */
export function isRoomExpired(
  now: number,
  lastActivityAt: number,
  maxExpiresAt: number
): boolean {
  if (now > maxExpiresAt) return true;
  if (now - lastActivityAt > INACTIVITY_TIMEOUT_MS) return true;
  return false;
}

/**
 * Calculate seconds remaining until room expires
 */
export function calculateRemainingSeconds(
  now: number,
  lastActivityAt: number,
  maxExpiresAt: number
): number {
  const inactivityExpiry = lastActivityAt + INACTIVITY_TIMEOUT_MS;
  const effectiveExpiry = Math.min(inactivityExpiry, maxExpiresAt);
  const diffMs = effectiveExpiry - now;
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * In-memory rate limiter with sliding window
 */
export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxAllowed: number;

  constructor(windowMs: number, maxAllowed: number) {
    this.windowMs = windowMs;
    this.maxAllowed = maxAllowed;
  }

  public isAllowed(key: string, now: number = Date.now()): boolean {
    const timestamps = this.requests.get(key) || [];
    const threshold = now - this.windowMs;

    // Filter out timestamps outside window
    const activeTimestamps = timestamps.filter(t => t > threshold);

    if (activeTimestamps.length >= this.maxAllowed) {
      this.requests.set(key, activeTimestamps);
      return false;
    }

    activeTimestamps.push(now);
    this.requests.set(key, activeTimestamps);
    return true;
  }

  public getRemainingAttempts(key: string, now: number = Date.now()): number {
    const timestamps = this.requests.get(key) || [];
    const threshold = now - this.windowMs;
    const activeCount = timestamps.filter(t => t > threshold).length;
    return Math.max(0, this.maxAllowed - activeCount);
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }
}
