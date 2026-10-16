import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFileSize,
  validateRoomCode,
  sanitizeRoomCode,
  getFileExtension,
  getRemainingTimeDisplay,
} from './formatters.ts';

test('formatFileSize formats bytes, KB, and MB accurately', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(10 * 1024 * 1024), '10.0 MB');
});

test('validateRoomCode strictly checks 6 numeric digits', () => {
  assert.equal(validateRoomCode('945165'), true);
  assert.equal(validateRoomCode('12345'), false);
  assert.equal(validateRoomCode('1234567'), false);
  assert.equal(validateRoomCode('abc123'), false);
  assert.equal(validateRoomCode(''), false);
});

test('sanitizeRoomCode strips non-numeric characters and limits to 6', () => {
  assert.equal(sanitizeRoomCode('945-165'), '945165');
  assert.equal(sanitizeRoomCode('a9b4c5d1e6f5g999'), '945165');
  assert.equal(sanitizeRoomCode('12'), '12');
});

test('getFileExtension retrieves lowercase extension without dot', () => {
  assert.equal(getFileExtension('photo.JPG'), 'jpg');
  assert.equal(getFileExtension('archive.tar.gz'), 'gz');
  assert.equal(getFileExtension('noextension'), '');
});

test('getRemainingTimeDisplay returns mm:ss formatted string', () => {
  assert.equal(getRemainingTimeDisplay(3600), '60:00');
  assert.equal(getRemainingTimeDisplay(65), '01:05');
  assert.equal(getRemainingTimeDisplay(0), '00:00');
  assert.equal(getRemainingTimeDisplay(-5), '00:00');
});
