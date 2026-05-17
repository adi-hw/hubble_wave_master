import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RecoveryService } from './recovery.service';
import { BackupTriggerDto, RestoreTriggerDto } from './recovery.dto';

/**
 * Canon §28 / W2 Stream 3 — disaster-recovery surface. Both backup
 * and restore triggers are gated by `control_plane:recovery:invoke`
 * (dangerous — restore mutates customer data state).
 */
@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('backup')
  @RequirePermission('control_plane:recovery:invoke')
  triggerBackup(@Body() dto: BackupTriggerDto, @CurrentUser('id') userId: string) {
    return this.recoveryService.triggerBackup(dto, userId);
  }

  @Post('restore')
  @RequirePermission('control_plane:recovery:invoke')
  triggerRestore(@Body() dto: RestoreTriggerDto, @CurrentUser('id') userId: string) {
    return this.recoveryService.triggerRestore(dto, userId);
  }
}
