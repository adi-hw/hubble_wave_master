import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard)
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
