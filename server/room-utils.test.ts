import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRoomCode,
  sanitizeFilename,
  formatBytes,
  isRoomExpired,
  calculateRemainingSeconds,
  SlidingWindowRateLimiter,
  INACTIVITY_TIMEOUT_MS,
  MAX_ROOM_LIFETIME_MS,
} from './room-utils.ts';

test('generateRoomCode generates 6-digit numeric codes between 100000 and 999999', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.match(code, /^[1-9][0-9]{5}$/);
    const num = parseInt(code, 10);
    assert.ok(num >= 100000 && num <= 999999);
  }
});

test('sanitizeFilename removes path traversal and dangerous characters', () => {
  assert.equal(sanitizeFilename('../../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('C:\\Users\\admin\\document.pdf'), 'document.pdf');
  assert.equal(sanitizeFilename('my file (1).png'), 'my file (1).png');
  assert.equal(sanitizeFilename('hello\x00world.txt'), 'helloworld.txt');
  assert.equal(sanitizeFilename('..hidden..file.zip'), 'hidden.file.zip');
  assert.equal(sanitizeFilename(''), 'unnamed-file');
  assert.equal(sanitizeFilename('   '), 'unnamed-file');
  // Unicode support
  assert.equal(sanitizeFilename('résumé_日本語.pdf'), 'résumé_日本語.pdf');
});

test('formatBytes formats file sizes correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1572864), '1.5 MB');
  assert.equal(formatBytes(104857600), '100 MB');
});

test('isRoomExpired evaluates inactivity and absolute max lifetime correctly', () => {
  const now = 100000000;
  const createdAt = now - 100000;
  const maxExpiresAt = createdAt + MAX_ROOM_LIFETIME_MS;

  // Active room with recent activity
  assert.equal(isRoomExpired(now, now - 1000, maxExpiresAt), false);

  // Expired due to 60+ minutes inactivity
  const inactiveActivity = now - (INACTIVITY_TIMEOUT_MS + 1000);
  assert.equal(isRoomExpired(now, inactiveActivity, maxExpiresAt), true);

  // Expired due to reaching max 6-hour limit even if recently active
  const pastMaxExpiresAt = now - 10;
  assert.equal(isRoomExpired(now, now, pastMaxExpiresAt), true);
});

test('calculateRemainingSeconds computes correct countdown', () => {
  const now = 100000000;
  const lastActivityAt = now - 10 * 60 * 1000; // 10 minutes ago
  const maxExpiresAt = now + 5 * 60 * 60 * 1000; // 5 hours left

  // Inactivity timeout is 60m, so 50 minutes (3000 seconds) remaining
  const remaining = calculateRemainingSeconds(now, lastActivityAt, maxExpiresAt);
  assert.equal(remaining, 50 * 60);
});

test('SlidingWindowRateLimiter limits attempts and resets window', () => {
  const limiter = new SlidingWindowRateLimiter(60000, 3);
  const ip = '192.168.1.1';
  const now = 1000000;

  assert.equal(limiter.isAllowed(ip, now), true);
  assert.equal(limiter.isAllowed(ip, now + 100), true);
  assert.equal(limiter.isAllowed(ip, now + 200), true);
  // 4th request within window is blocked
  assert.equal(limiter.isAllowed(ip, now + 300), false);
  assert.equal(limiter.getRemainingAttempts(ip, now + 300), 0);

  // After window expires (60s later)
  assert.equal(limiter.isAllowed(ip, now + 65000), true);
});
