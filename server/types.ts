export interface StoredFile {
  id: string;
  roomId: string;
  originalFilename: string;
  sanitizedFilename: string;
  sizeBytes: number;
  mimeType: string;
  storageKey: string;
  createdAt: number;
  sha256?: string;
  isComplete: boolean;
}

export interface Room {
  id: string;
  code: string;
  createdAt: number;
  lastActivityAt: number;
  maxExpiresAt: number;
  status: 'active' | 'ended' | 'expired';
  creatorToken: string;
  files: StoredFile[];
}

export interface RoomPublicView {
  id: string;
  code: string;
  createdAt: number;
  lastActivityAt: number;
  expiresInSeconds: number;
  status: 'active' | 'ended' | 'expired';
  isCreator?: boolean;
  files: {
    id: string;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: number;
    isComplete: boolean;
  }[];
}

export interface StorageConfig {
  driver: 'r2' | 'disk';
  bucket?: string;
  isCloudStorage: boolean;
}
