import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

export interface StorageResult {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface StorageReadStream {
  stream: NodeJS.ReadableStream;
  contentLength?: number;
  contentType?: string;
}

export interface StorageProviderInfo {
  name: 'Cloudflare R2' | 'AWS S3' | 'Server Disk (Encrypted Temp)';
  isCloudStorage: boolean;
  bucket?: string;
  endpoint?: string;
  description: string;
}

export interface StorageEngine {
  saveStream(
    roomId: string,
    fileId: string,
    stream: NodeJS.ReadableStream,
    mimeType: string,
    maxSizeBytes: number
  ): Promise<StorageResult>;
  getReadStream(storageKey: string): Promise<StorageReadStream>;
  deleteFile(storageKey: string): Promise<void>;
  deleteRoomFiles(roomId: string): Promise<void>;
  getProviderInfo(): StorageProviderInfo;
}

/**
 * Cloudflare R2 / S3 Object Storage Provider
 */
export class S3StorageEngine implements StorageEngine {
  private client: S3Client;
  private bucket: string;
  private isR2: boolean;

  constructor(config: {
    accountId?: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
    region?: string;
  }) {
    this.bucket = config.bucket;
    this.isR2 = Boolean(config.accountId || config.endpoint?.includes('r2.cloudflarestorage.com'));

    const endpoint = config.endpoint || (config.accountId ? `https://${config.accountId}.r2.cloudflarestorage.com` : undefined);

    this.client = new S3Client({
      region: config.region || (this.isR2 ? 'auto' : 'us-east-1'),
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  getProviderInfo(): StorageProviderInfo {
    return {
      name: this.isR2 ? 'Cloudflare R2' : 'AWS S3',
      isCloudStorage: true,
      bucket: this.bucket,
      description: 'Distributed zero-egress object storage connected.',
    };
  }

  async saveStream(
    roomId: string,
    fileId: string,
    stream: NodeJS.ReadableStream,
    mimeType: string,
    maxSizeBytes: number
  ): Promise<StorageResult> {
    const key = `rooms/${roomId}/${fileId}`;
    const hash = crypto.createHash('sha256');
    let sizeBytes = 0;

    const chunks: Buffer[] = [];

    // Stream through hash and accumulate size, validating max limits
    for await (const chunk of stream) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += bufferChunk.length;
      if (sizeBytes > maxSizeBytes) {
        throw new Error(`File exceeded maximum limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB`);
      }
      hash.update(bufferChunk);
      chunks.push(bufferChunk);
    }

    const fileBuffer = Buffer.concat(chunks);
    const sha256 = hash.digest('hex');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType || 'application/octet-stream',
        Metadata: {
          roomId,
          fileId,
          sha256,
        },
      })
    );

    return {
      storageKey: key,
      sizeBytes,
      sha256,
    };
  }

  async getReadStream(storageKey: string): Promise<StorageReadStream> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    );

    if (!response.Body) {
      throw new Error('Storage object contains empty body');
    }

    return {
      stream: response.Body as unknown as NodeJS.ReadableStream,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      );
    } catch (err) {
      console.error(`Failed to delete S3 file ${storageKey}:`, err);
    }
  }

  async deleteRoomFiles(roomId: string): Promise<void> {
    try {
      const prefix = `rooms/${roomId}/`;
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const listRes = await this.client.send(listCmd);
      if (listRes.Contents && listRes.Contents.length > 0) {
        const deleteParams = {
          Bucket: this.bucket,
          Delete: {
            Objects: listRes.Contents.map(obj => ({ Key: obj.Key })),
          },
        };
        await this.client.send(new DeleteObjectsCommand(deleteParams));
      }
    } catch (err) {
      console.error(`Failed to delete room files in S3 for room ${roomId}:`, err);
    }
  }
}

/**
 * Local Server Disk Storage Provider (Streaming, isolated, auto-expiring)
 */
export class DiskStorageEngine implements StorageEngine {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getProviderInfo(): StorageProviderInfo {
    return {
      name: 'Server Disk (Encrypted Temp)',
      isCloudStorage: false,
      description: 'Built-in container storage active. For distributed edge storage across multiple instances, add Cloudflare R2 credentials.',
    };
  }

  async saveStream(
    roomId: string,
    fileId: string,
    stream: NodeJS.ReadableStream,
    mimeType: string,
    maxSizeBytes: number
  ): Promise<StorageResult> {
    const roomDir = path.join(this.baseDir, roomId);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    const filePath = path.join(roomDir, fileId);
    const hash = crypto.createHash('sha256');
    let sizeBytes = 0;

    const writeStream = fs.createWriteStream(filePath, { flags: 'w' });

    // Track bytes and hash as we stream directly to disk without holding entire file in RAM
    for await (const chunk of stream) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += bufferChunk.length;
      if (sizeBytes > maxSizeBytes) {
        writeStream.destroy();
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
        throw new Error(`File exceeded maximum limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB`);
      }
      hash.update(bufferChunk);
      writeStream.write(bufferChunk);
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const sha256 = hash.digest('hex');

    return {
      storageKey: path.relative(this.baseDir, filePath),
      sizeBytes,
      sha256,
    };
  }

  async getReadStream(storageKey: string): Promise<StorageReadStream> {
    // Prevent directory traversal
    const safePath = path.resolve(this.baseDir, storageKey);
    if (!safePath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Invalid storage path');
    }

    if (!fs.existsSync(safePath)) {
      throw new Error('File not found on storage');
    }

    const stat = fs.statSync(safePath);
    const stream = fs.createReadStream(safePath);

    return {
      stream,
      contentLength: stat.size,
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const safePath = path.resolve(this.baseDir, storageKey);
      if (safePath.startsWith(this.baseDir) && fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
      }
    } catch (err) {
      console.error(`Failed to delete local file ${storageKey}:`, err);
    }
  }

  async deleteRoomFiles(roomId: string): Promise<void> {
    try {
      const roomDir = path.join(this.baseDir, roomId);
      if (fs.existsSync(roomDir)) {
        fs.rmSync(roomDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Failed to delete room directory ${roomId}:`, err);
    }
  }
}

/**
 * Factory function to initialize the appropriate storage engine based on environment
 */
export function createStorageEngine(): StorageEngine {
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;

  if (accessKeyId && secretAccessKey && bucket) {
    console.log('[Storage] Initializing Cloudflare R2 / S3 Object Storage...');
    return new S3StorageEngine({
      accountId: r2AccountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint: process.env.R2_ENDPOINT || process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
    });
  }

  console.log('[Storage] Initializing Temporary Server Disk Storage...');
  return new DiskStorageEngine();
}
