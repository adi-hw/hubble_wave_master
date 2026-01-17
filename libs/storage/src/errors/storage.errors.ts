export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'StorageNotFoundError';
  }
}
