import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import Busboy from 'busboy';
import dotenv from 'dotenv';
import { createStorageEngine } from './server/storage/storage-engine.ts';
import { RoomStore } from './server/room-store.ts';
import {
  generateId,
  sanitizeFilename,
  MAX_FILE_SIZE_BYTES,
  INACTIVITY_TIMEOUT_MS,
  MAX_ROOM_LIFETIME_MS,
} from './server/room-utils.ts';
import type { StoredFile } from './server/types.ts';

dotenv.config();

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined;
const PORT = parseInt(portFromArg || process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// JSON parsing for standard API bodies
app.use(express.json());

// Initialize Storage and Room Management
const storageEngine = createStorageEngine();
const roomStore = new RoomStore(storageEngine);

// Helper to get client IP for rate limiting
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/* ========================================================================== */
/*                             API ROUTER                                     */
/* ========================================================================== */

// 1. System Info & Storage Engine status
app.get('/api/system/info', (_req: Request, res: Response) => {
  const provider = storageEngine.getProviderInfo();
  res.json({
    status: 'ok',
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    maxFileSizeMb: Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024)),
    inactivityTimeoutMinutes: Math.round(INACTIVITY_TIMEOUT_MS / 60000),
    maxLifetimeHours: Math.round(MAX_ROOM_LIFETIME_MS / 3600000),
    storage: provider,
  });
});

// 2. Create a new Room
app.post('/api/rooms', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!roomStore.roomCreateLimiter.isAllowed(ip)) {
    res.status(429).json({
      error: 'Rate limit exceeded: Too many rooms created. Please wait a few minutes.',
    });
    return;
  }

  const { room, creatorToken } = roomStore.createRoom();

  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const shareUrl = `${baseUrl.replace(/\/$/, '')}/?room=${room.code}`;

  res.status(201).json({
    room: roomStore.toPublicView(room, creatorToken),
    creatorToken,
    shareUrl,
  });
});

// 3. Get Room by ID
app.get('/api/rooms/:id', (req: Request, res: Response) => {
  const roomId = req.params.id;
  const creatorToken = req.headers['x-creator-token'] as string | undefined;

  const room = roomStore.getRoomById(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found or expired.' });
    return;
  }

  res.json({
    room: roomStore.toPublicView(room, creatorToken),
  });
});

// 4. Join / Lookup Room by 6-digit Code (with rate limiting against brute force)
app.get('/api/rooms/by-code/:code', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const code = (req.params.code || '').trim();

  // Validate format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid room code format. Must be a 6-digit number.' });
    return;
  }

  // Rate limit code guessing
  if (!roomStore.codeGuessLimiter.isAllowed(ip)) {
    res.status(429).json({
      error: 'Too many attempts. To protect transfers, please wait 60 seconds before trying another code.',
    });
    return;
  }

  const room = roomStore.getRoomByCode(code);
  if (!room) {
    res.status(404).json({
      error: 'Room not found, closed, or expired. Please check the code with the sender.',
    });
    return;
  }

  if (room.status !== 'active') {
    res.status(410).json({
      error: `This room is no longer active (status: ${room.status}).`,
    });
    return;
  }

  // Reset failed rate limit counter on successful code match
  roomStore.codeGuessLimiter.reset(ip);
  roomStore.touchRoom(room.id);

  res.json({
    room: roomStore.toPublicView(room),
  });
});

// 5. Upload File to Room (Streaming via busboy, zero entire-file RAM buffering)
app.post('/api/rooms/:id/upload', (req: Request, res: Response) => {
  const roomId = req.params.id;
  const ip = getClientIp(req);

  const room = roomStore.getRoomById(roomId);
  if (!room || room.status !== 'active') {
    res.status(404).json({ error: 'Room does not exist, is ended, or has expired.' });
    return;
  }

  if (!roomStore.uploadLimiter.isAllowed(ip)) {
    res.status(429).json({ error: 'Upload rate limit reached. Please wait a moment.' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: 'Invalid content type. Expected multipart/form-data.' });
    return;
  }

  let busboy: ReturnType<typeof Busboy>;
  try {
    busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
      },
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to parse multipart request header.' });
    return;
  }

  let fileHandled = false;
  let uploadPromise: Promise<void> | null = null;
  let fileError: Error | null = null;

  busboy.on('file', (_name: string, fileStream: any, info: any) => {
    if (fileHandled) {
      fileStream.resume();
      return;
    }
    fileHandled = true;

    const { filename, mimeType } = info;
    const fileId = generateId();
    const sanitized = sanitizeFilename(filename);

    uploadPromise = (async () => {
      try {
        const result = await storageEngine.saveStream(
          roomId,
          fileId,
          fileStream,
          mimeType,
          MAX_FILE_SIZE_BYTES
        );

        const storedFile: StoredFile = {
          id: fileId,
          roomId,
          originalFilename: filename || 'unnamed-file',
          sanitizedFilename: sanitized,
          sizeBytes: result.sizeBytes,
          mimeType: mimeType || 'application/octet-stream',
          storageKey: result.storageKey,
          createdAt: Date.now(),
          sha256: result.sha256,
          isComplete: true,
        };

        const added = roomStore.addFileToRoom(roomId, storedFile);
        if (!added) {
          await storageEngine.deleteFile(result.storageKey);
          throw new Error('Room was ended or expired during upload');
        }

        const creatorToken = req.headers['x-creator-token'] as string | undefined;
        res.status(201).json({
          success: true,
          file: {
            id: storedFile.id,
            originalFilename: storedFile.originalFilename,
            sizeBytes: storedFile.sizeBytes,
            mimeType: storedFile.mimeType,
            createdAt: storedFile.createdAt,
            sha256: storedFile.sha256,
          },
          room: roomStore.toPublicView(room, creatorToken),
        });
      } catch (err: any) {
        fileError = err;
        if (!res.headersSent) {
          res.status(err.message?.includes('exceeded maximum limit') ? 413 : 500).json({
            error: err.message || 'File upload failed.',
          });
        }
      }
    })();
  });

  busboy.on('error', (err: any) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Busboy parsing error' });
    }
  });

  busboy.on('finish', () => {
    if (!fileHandled && !res.headersSent) {
      res.status(400).json({ error: 'No file found in request payload.' });
    }
  });

  req.pipe(busboy);
});

// 6. Download File with streaming and safe Content-Disposition
app.get('/api/files/:fileId/download', async (req: Request, res: Response) => {
  const fileId = req.params.fileId;

  // Find file across rooms
  let targetFile: StoredFile | null = null;
  let targetRoom: any = null;

  // Find the file's room
  // We inspect rooms in store
  const allRooms = (roomStore as any).rooms as Map<string, any>;
  for (const r of allRooms.values()) {
    const found = r.files.find((f: StoredFile) => f.id === fileId);
    if (found) {
      targetFile = found;
      targetRoom = r;
      break;
    }
  }

  if (!targetFile || !targetRoom) {
    res.status(404).json({ error: 'File not found or room expired.' });
    return;
  }

  // Check room status
  const currentRoom = roomStore.getRoomById(targetRoom.id);
  if (!currentRoom || currentRoom.status !== 'active') {
    res.status(410).json({ error: 'The room containing this file has ended or expired.' });
    return;
  }

  try {
    const { stream, contentLength } = await storageEngine.getReadStream(targetFile.storageKey);

    // Refresh room activity timer on download
    roomStore.touchRoom(targetRoom.id);

    // Use safe RFC 5987 / RFC 6266 filename encoding for UTF-8 preservation
    const safeAscii = targetFile.sanitizedFilename.replace(/[^\x20-\x7E]/g, '_');
    const utf8Encoded = encodeURIComponent(targetFile.sanitizedFilename);

    res.setHeader('Content-Type', targetFile.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`
    );
    if (contentLength || targetFile.sizeBytes) {
      res.setHeader('Content-Length', contentLength || targetFile.sizeBytes);
    }
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    stream.pipe(res);
  } catch (err: any) {
    console.error('Download stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file from storage.' });
    }
  }
});

// 7. Delete File from Room (Creator only)
app.delete('/api/rooms/:id/files/:fileId', async (req: Request, res: Response) => {
  const roomId = req.params.id;
  const fileId = req.params.fileId;
  const creatorToken = req.headers['x-creator-token'] as string | undefined;

  if (!creatorToken) {
    res.status(401).json({ error: 'Unauthorized: Creator token required.' });
    return;
  }

  try {
    const removed = await roomStore.removeFile(roomId, fileId, creatorToken);
    if (!removed) {
      res.status(404).json({ error: 'File or room not found.' });
      return;
    }

    const room = roomStore.getRoomById(roomId);
    res.json({
      success: true,
      room: room ? roomStore.toPublicView(room, creatorToken) : null,
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Failed to remove file.' });
  }
});

// 8. End Room Immediately (Creator only)
app.post('/api/rooms/:id/end', async (req: Request, res: Response) => {
  const roomId = req.params.id;
  const creatorToken = req.headers['x-creator-token'] as string | undefined;

  if (!creatorToken) {
    res.status(401).json({ error: 'Unauthorized: Creator token required.' });
    return;
  }

  try {
    const ended = await roomStore.endRoom(roomId, creatorToken);
    if (!ended) {
      res.status(404).json({ error: 'Room already ended or not found.' });
      return;
    }

    res.json({ success: true, message: 'Room ended and files purged successfully.' });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Failed to end room.' });
  }
});

/* ========================================================================== */
/*                   VITE / STATIC ASSET INTEGRATION                          */
/* ========================================================================== */

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: attach Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built static files from dist
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[QuickDrop] Server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[QuickDrop] Failed to start server:', err);
  process.exit(1);
});
