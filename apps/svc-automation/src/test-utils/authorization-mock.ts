// Test-only stub for `@hubblewave/authorization`. Same rationale as
// `instance-db-mock`: the real library transitively imports the
// in-flight instance-db barrel, so we provide just the surface the
// runtime touches.

export class AuthorizationService {
  async ensureCollectionAccess(): Promise<void> {
    return;
  }
  async filterWritableFieldsForCollection<T>(_ctx: unknown, _id: unknown, props: T): Promise<T> {
    return props;
  }
  async getAuthorizedFields(): Promise<Array<{ code: string; canRead: boolean }>> {
    return [];
  }
}
