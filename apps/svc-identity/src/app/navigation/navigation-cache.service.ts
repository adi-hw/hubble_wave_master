import { Injectable } from '@nestjs/common';

@Injectable()
export class NavigationCacheService {
  async getCachedNavigation(): Promise<null> {
    return null;
  }

  async cacheNavigation(): Promise<void> {}
}
