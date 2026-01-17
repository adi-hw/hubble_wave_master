export const STORAGE_CLIENT = 'STORAGE_CLIENT';

export type SignedUrlOperation = 'get' | 'put';

export interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface GetObjectParams {
  bucket: string;
  key: string;
}

export interface DeleteObjectParams {
  bucket: string;
  key: string;
}

export interface ListObjectsParams {
  bucket: string;
  prefix?: string;
}

export interface SignedUrlParams {
  bucket: string;
  key: string;
  operation: SignedUrlOperation;
  expiresInSeconds?: number;
  contentType?: string;
}

export interface StorageClient {
  ensureBucket(bucket: string): Promise<void>;
  putObject(params: PutObjectParams): Promise<void>;
  getObject(params: GetObjectParams): Promise<Buffer>;
  deleteObject(params: DeleteObjectParams): Promise<void>;
  listObjects(params: ListObjectsParams): Promise<string[]>;
  getSignedUrl(params: SignedUrlParams): Promise<string>;
}
