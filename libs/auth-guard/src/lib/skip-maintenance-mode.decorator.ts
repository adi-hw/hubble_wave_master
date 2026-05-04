import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key the MaintenanceModeInterceptor inspects to determine whether a
 * handler should bypass the read-only gate enforced during pack install.
 */
export const SKIP_MAINTENANCE_MODE_KEY = 'skipMaintenanceMode';

/**
 * Marks a controller or handler as exempt from the maintenance-mode read-only
 * gate that activates while a pack install or rollback is in progress.
 *
 * Apply to:
 *   - the pack install / rollback endpoints themselves (otherwise they would
 *     be blocked by the very flag they set)
 *   - administrative or operational endpoints whose continued availability is
 *     required to recover from a stuck install
 *
 * Identity (login, refresh) is in a separate service that does not wire the
 * interceptor; it does not need this decorator.
 */
export const SkipMaintenanceMode = () => SetMetadata(SKIP_MAINTENANCE_MODE_KEY, true);
