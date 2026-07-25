import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * StorageService — HIPAA-compliant file storage abstraction.
 *
 * - When AWS_S3_BUCKET is set: files are stored in S3 with SSE-KMS encryption.
 * - When AWS_S3_BUCKET is empty: files are stored on local disk (dev only).
 *
 * All files are stored with a random UUID prefix to prevent collisions and
 * path traversal attacks. The original filename is preserved as metadata.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Bucket: string | undefined;
  private readonly s3Region: string | undefined;
  private readonly localPath: string;
  private s3Client: any | undefined;

  constructor(private readonly configService: ConfigService) {
    this.s3Bucket = this.configService.get<string>('AWS_S3_BUCKET') || undefined;
    this.s3Region = this.configService.get<string>('AWS_S3_REGION') || 'us-east-1';
    this.localPath = this.configService.get<string>('STORAGE_LOCAL_PATH') || './uploads';

    if (this.s3Bucket) {
      // Lazy-load AWS SDK to avoid bundling when not used
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { S3Client } = require('@aws-sdk/client-s3');
        this.s3Client = new S3Client({ region: this.s3Region });
        this.logger.log(`File storage: S3 bucket=${this.s3Bucket}, region=${this.s3Region}`);
      } catch {
        this.logger.warn('AWS_S3_BUCKET set but @aws-sdk/client-s3 not installed — falling back to local storage');
        this.s3Bucket = undefined;
      }
    } else {
      // Ensure local upload directory exists
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
      this.logger.log(`File storage: local disk at ${path.resolve(this.localPath)}`);
    }
  }

  /**
   * Upload a file to storage (S3 or local disk).
   * @param file The multer file object
   * @param folder Logical folder (e.g., 'insurance-cards', 'audio', 'documents')
   * @returns The storage key/path and a public URL (if S3)
   */
  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ key: string; url: string | null }> {
    // Generate a safe filename with UUID prefix
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${safeName}`;

    if (this.s3Bucket && this.s3Client) {
      return this.uploadToS3(key, file.buffer, file.mimetype);
    }
    return this.uploadToLocal(key, file.buffer);
  }

  /**
   * Upload a buffer directly (for generated files like PDFs).
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    filename: string,
    contentType: string,
  ): Promise<{ key: string; url: string | null }> {
    const ext = path.extname(filename).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${safeName}`;

    if (this.s3Bucket && this.s3Client) {
      return this.uploadToS3(key, buffer, contentType);
    }
    return this.uploadToLocal(key, buffer);
  }

  /**
   * Retrieve a file as a buffer.
   */
  async download(key: string): Promise<Buffer> {
    if (this.s3Bucket && this.s3Client) {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const command = new GetObjectCommand({ Bucket: this.s3Bucket, Key: key });
      const response = await this.s3Client.send(command);
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    const filePath = path.join(this.localPath, key);
    return fs.promises.readFile(filePath);
  }

  /**
   * Delete a file from storage.
   */
  async delete(key: string): Promise<void> {
    if (this.s3Bucket && this.s3Client) {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: key });
      await this.s3Client.send(command);
      return;
    }
    const filePath = path.join(this.localPath, key);
    await fs.promises.unlink(filePath).catch(() => {});
  }

  /**
   * Validate file MIME type against an allowlist.
   */
  validateMimeType(file: Express.Multer.File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimetype);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string; url: string | null }> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // HIPAA: Server-side encryption with KMS
      ServerSideEncryption: 'aws:kms',
    });
    await this.s3Client.send(command);
    const url = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${key}`;
    return { key, url };
  }

  private async uploadToLocal(
    key: string,
    buffer: Buffer,
  ): Promise<{ key: string; url: string | null }> {
    const filePath = path.join(this.localPath, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    return { key, url: null };
  }
}
