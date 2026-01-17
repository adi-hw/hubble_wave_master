import {
  BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import {
  StorageClient,
  PutObjectParams,
  GetObjectParams,
  DeleteObjectParams,
  ListObjectsParams,
  SignedUrlParams,
} from '../storage.client';
import { StorageConfig } from '../storage.config';
import { StorageError, StorageNotFoundError } from '../errors/storage.errors';
import { signGetObjectUrl, signPutObjectUrl } from './s3.signing';

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
    const arrayBuffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  return Buffer.from(JSON.stringify(body));
}

function buildClientConfig(config: StorageConfig): S3ClientConfig {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    forcePathStyle: config.forcePathStyle,
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    };
  }

  return clientConfig;
}

export class S3StorageClient implements StorageClient {
  private readonly client: S3Client;
  private readonly region: string;

  constructor(config: StorageConfig) {
    this.client = new S3Client(buildClientConfig(config));
    this.region = config.region;
  }

  async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const errorName = (error as { name?: string }).name;
      const shouldCreate = statusCode === 404 || errorName === 'NotFound' || errorName === 'NoSuchBucket';
      if (!shouldCreate) {
        throw new StorageError(`Failed to access bucket ${bucket}`, error);
      }

      const createConfig = this.region === 'us-east-1'
        ? { Bucket: bucket }
        : {
            Bucket: bucket,
            CreateBucketConfiguration: {
              LocationConstraint: this.region as BucketLocationConstraint,
            },
          };

      try {
        await this.client.send(new CreateBucketCommand(createConfig));
      } catch (createError: unknown) {
        const createName = (createError as { name?: string }).name;
        if (createName !== 'BucketAlreadyOwnedByYou') {
          throw new StorageError(`Failed to create bucket ${bucket}`, createError);
        }
      }
    }
  }

  async putObject(params: PutObjectParams): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          Metadata: params.metadata,
        })
      );
    } catch (error: unknown) {
      throw new StorageError(`Failed to put object ${params.bucket}/${params.key}`, error);
    }
  }

  async getObject(params: GetObjectParams): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: params.bucket, Key: params.key })
      );
      return streamToBuffer(response.Body);
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const errorName = (error as { name?: string }).name;
      if (statusCode === 404 || errorName === 'NoSuchKey') {
        throw new StorageNotFoundError(`Object not found: ${params.bucket}/${params.key}`, error);
      }
      throw new StorageError(`Failed to get object ${params.bucket}/${params.key}`, error);
    }
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: params.bucket, Key: params.key })
      );
    } catch (error: unknown) {
      throw new StorageError(`Failed to delete object ${params.bucket}/${params.key}`, error);
    }
  }

  async listObjects(params: ListObjectsParams): Promise<string[]> {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({ Bucket: params.bucket, Prefix: params.prefix })
      );
      return (response.Contents || [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key));
    } catch (error: unknown) {
      throw new StorageError(`Failed to list objects in ${params.bucket}`, error);
    }
  }

  async getSignedUrl(params: SignedUrlParams): Promise<string> {
    try {
      if (params.operation === 'put') {
        return signPutObjectUrl(
          this.client,
          params.bucket,
          params.key,
          params.contentType,
          params.expiresInSeconds
        );
      }
      return signGetObjectUrl(
        this.client,
        params.bucket,
        params.key,
        params.expiresInSeconds
      );
    } catch (error: unknown) {
      throw new StorageError(`Failed to sign URL for ${params.bucket}/${params.key}`, error);
    }
  }
}
