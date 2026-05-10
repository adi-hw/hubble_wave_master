import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { RecoveryService } from './recovery.service';
import { BackupTriggerDto, RestoreTriggerDto } from './recovery.dto';

@Controller('recovery')
@Roles('operator')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('backup')
  triggerBackup(@Body() dto: BackupTriggerDto, @CurrentUser('id') userId: string) {
    return this.recoveryService.triggerBackup(dto, userId);
  }

  @Post('restore')
  triggerRestore(@Body() dto: RestoreTriggerDto, @CurrentUser('id') userId: string) {
    return this.recoveryService.triggerRestore(dto, userId);
  }
}
