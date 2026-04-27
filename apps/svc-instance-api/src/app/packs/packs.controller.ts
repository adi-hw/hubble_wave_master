import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { PacksService } from './packs.service';
import { PackInstallDto, PackRollbackDto } from './dto/pack-install.dto';
import { PackInstallTokenGuard } from './guards/pack-install-token.guard';

@Controller('packs')
@UseGuards(JwtAuthGuard, PackInstallTokenGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
  }),
)
export class PacksController {
  private readonly logger = new Logger(PacksController.name);

  constructor(private readonly packsService: PacksService) {}

  @Post('install')
  @HttpCode(HttpStatus.ACCEPTED)
  async install(@Body() payload: PackInstallDto) {
    this.logger.log(`Received pack install request: ${payload.packCode}@${payload.releaseId}`);
    return this.packsService.install(payload);
  }

  @Post('rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  async rollback(@Body() payload: PackRollbackDto) {
    this.logger.log(`Received pack rollback request: ${payload.packCode}@${payload.releaseId}`);
    return this.packsService.rollback(payload);
  }

  @Get('releases')
  async listReleases(
    @Query('packCode') packCode?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.packsService.listReleases({ packCode, status, limit });
  }
}
