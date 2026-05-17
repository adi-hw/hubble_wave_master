import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import {
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { BackupService } from './backup.service';

/**
 * Canon §28 / W2 Stream 3 — backup + restore are platform-admin
 * operations. Gated by `@RequirePermission('system:configure')`. The
 * pre-Stream-3 `context.isAdmin` runtime check inside each handler
 * is now redundant with the capability gate; left in place as
 * defense in depth pending a follow-up cleanup.
 */
@Controller('backup')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('system:configure')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('run')
  async run(@Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    if (!context.isAdmin) {
      throw new ForbiddenException('Admin role is required to run backups');
    }
    return this.backupService.runBackup('manual', context.userId || undefined);
  }

  @Post('restore')
  async restore(@Body() body: { backupId?: string }, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    if (!context.isAdmin) {
      throw new ForbiddenException('Admin role is required to restore backups');
    }
    return this.backupService.restoreBackup(body.backupId || '', context.userId || undefined);
  }
}
