import { Global, Module } from '@nestjs/common';

/**
 * KernelModule provides the foundational types, errors, and RequestContext
 * used by every other module in apps/api.
 *
 * @Global means consumers don't need to import KernelModule explicitly;
 * exports propagate automatically. Currently kernel is type-only (no runtime
 * providers); the @Global decorator is forward-looking for when shared
 * services like RequestContextStorage (AsyncLocalStorage) get added.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class KernelModule {}
