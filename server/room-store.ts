import crypto from 'node:crypto';
import type { Room, StoredFile, RoomPublicView } from './types.ts';
import {
  generateRoomCode,
  generateId,
  isRoomExpired,
  calculateRemainingSeconds,
  MAX_ROOM_LIFETIME_MS,
  SlidingWindowRateLimiter,
} from './room-utils.ts';
import type { StorageEngine } from './storage/storage-engine.ts';

export class RoomStore {
  private rooms: Map<string, Room> = new Map(); // Keyed by roomId
  private codeToRoomId: Map<string, string> = new Map(); // Keyed by 6-digit code
  private storageEngine: StorageEngine;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Rate limiters
  public codeGuessLimiter = new SlidingWindowRateLimiter(60 * 1000, 10); // 10 guesses / min
  public roomCreateLimiter = new SlidingWindowRateLimiter(10 * 60 * 1000, 20); // 20 rooms / 10 min
  public uploadLimiter = new SlidingWindowRateLimiter(5 * 60 * 1000, 40); // 40 uploads / 5 min

  constructor(storageEngine: StorageEngine) {
    this.storageEngine = storageEngine;
    // Run cleanup cycle every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(err => console.error('[Cleanup Error]', err));
    }, 60 * 1000);
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create a new room with a collision-free 6-digit code and creator token
   */
  public createRoom(): { room: Room; creatorToken: string } {
    const id = generateId();
    const creatorToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    // Generate unique 6-digit code with collision check
    let code = generateRoomCode();
    let attempts = 0;
    while (this.codeToRoomId.has(code) && attempts < 100) {
      code = generateRoomCode();
      attempts++;
    }

    const room: Room = {
      id,
      code,
      createdAt: now,
      lastActivityAt: now,
      maxExpiresAt: now + MAX_ROOM_LIFETIME_MS,
      status: 'active',
      creatorToken,
      files: [],
    };

    this.rooms.set(id, room);
    this.codeToRoomId.set(code, id);

    return { room, creatorToken };
  }

  /**
   * Find room by internal ID
   */
  public getRoomById(id: string): Room | null {
    const room = this.rooms.get(id);
    if (!room) return null;

    const now = Date.now();
    if (room.status !== 'active' || isRoomExpired(now, room.lastActivityAt, room.maxExpiresAt)) {
      if (room.status === 'active') {
        room.status = 'expired';
      }
      return room;
    }

    return room;
  }

  /**
   * Find room by 6-digit code
   */
  public getRoomByCode(code: string): Room | null {
    const cleanCode = code.trim();
    const roomId = this.codeToRoomId.get(cleanCode);
    if (!roomId) return null;

    return this.getRoomById(roomId);
  }

  /**
   * Record activity (refreshes the 60m inactivity timer)
   */
  public touchRoom(id: string): void {
    const room = this.rooms.get(id);
    if (room && room.status === 'active') {
      room.lastActivityAt = Date.now();
    }
  }

  /**
   * Add a completed file to the room
   */
  public addFileToRoom(roomId: string, file: StoredFile): boolean {
    const room = this.getRoomById(roomId);
    if (!room || room.status !== 'active') return false;

    // Remove any previous uncompleted entry with same ID
    room.files = room.files.filter(f => f.id !== file.id);
    room.files.push(file);
    room.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Remove a file from the room and delete its binary object
   */
  public async removeFile(roomId: string, fileId: string, token: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Verify creator token
    if (room.creatorToken !== token) {
      throw new Error('Unauthorized: Only room creator can delete files');
    }

    const fileIndex = room.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return false;

    const [file] = room.files.splice(fileIndex, 1);
    room.lastActivityAt = Date.now();

    await this.storageEngine.deleteFile(file.storageKey);
    return true;
  }

  /**
   * End room immediately and delete all files
   */
  public async endRoom(roomId: string, token: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (room.creatorToken !== token) {
      throw new Error('Unauthorized: Only room creator can end room');
    }

    room.status = 'ended';
    this.codeToRoomId.delete(room.code);

    // Delete stored objects
    await this.storageEngine.deleteRoomFiles(roomId);
    this.rooms.delete(roomId);

    return true;
  }

  /**
   * Periodic garbage collection of expired or ended rooms
   */
  public async runCleanup(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, room] of this.rooms.entries()) {
      if (room.status === 'ended' || isRoomExpired(now, room.lastActivityAt, room.maxExpiresAt)) {
        room.status = 'expired';
        this.codeToRoomId.delete(room.code);
        this.rooms.delete(id);

        try {
          await this.storageEngine.deleteRoomFiles(id);
          cleanedCount++;
        } catch (err) {
          console.error(`[Cleanup] Failed to delete files for room ${id}:`, err);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Cleanup] Automatically purged ${cleanedCount} expired rooms and files.`);
    }

    return cleanedCount;
  }

  /**
   * Format room for safe public client consumption
   */
  public toPublicView(room: Room, clientToken?: string): RoomPublicView {
    const now = Date.now();
    const isCreator = Boolean(clientToken && room.creatorToken === clientToken);

    return {
      id: room.id,
      code: room.code,
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
      expiresInSeconds: calculateRemainingSeconds(now, room.lastActivityAt, room.maxExpiresAt),
      status: room.status,
      isCreator,
      files: room.files
        .filter(f => f.isComplete)
        .map(f => ({
          id: f.id,
          originalFilename: f.originalFilename,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
          createdAt: f.createdAt,
          isComplete: f.isComplete,
        })),
    };
  }
}
