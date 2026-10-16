export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export function sanitizeRoomCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, 6);
}

export function getFileExtension(filename: string): string {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getRemainingTimeDisplay(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
