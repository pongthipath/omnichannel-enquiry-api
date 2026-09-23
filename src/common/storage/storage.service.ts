import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

/**
 * Object storage (S3 in the cloud, MinIO locally). Files are served back through the API
 * (`GET /attachments/:id/file`) so the bucket stays private and every read is permission-checked.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'ap-southeast-1'),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}), // MinIO needs path-style URLs
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return result.Body as Readable;
  }

  /** Downloads an external file (webhook image) so it can be mirrored into our bucket. */
  async fetchExternal(url: string, maxBytes: number): Promise<{ body: Buffer; contentType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source responded ${res.status}`);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error(`source too large (${length} bytes)`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.byteLength > maxBytes) throw new Error(`source too large (${body.byteLength} bytes)`);
    return { body, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: '__healthcheck__' }));
      return true;
    } catch (e) {
      // NoSuchKey means the bucket is reachable, which is what we are checking
      return (e as { name?: string }).name === 'NoSuchKey';
    }
  }
}
