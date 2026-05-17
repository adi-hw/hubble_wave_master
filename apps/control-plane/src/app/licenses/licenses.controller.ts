import { Controller, Get, Post, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { CreateLicenseDto, UpdateLicenseStatusDto, ValidateLicenseDto } from './licenses.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — license records. Reads + validation by
 * `control_plane:license:read`; issuance and status mutation by
 * `control_plane:license:manage` (dangerous — entitlement boundary).
 */
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get()
  @RequirePermission('control_plane:license:read')
  async findAll(@Query('customerId') customerId?: string) {
    return this.licensesService.findAll(customerId);
  }

  @Get(':id')
  @RequirePermission('control_plane:license:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.licensesService.findOne(id);
  }

  @Post()
  @RequirePermission('control_plane:license:manage')
  async create(@Body() dto: CreateLicenseDto, @CurrentUser('id') userId: string) {
    return this.licensesService.create(dto, userId);
  }

  @Post(':id/status')
  @RequirePermission('control_plane:license:manage')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLicenseStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.licensesService.updateStatus(id, dto, userId);
  }

  @Post('validate')
  @RequirePermission('control_plane:license:read')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateLicenseDto) {
    return this.licensesService.validate(dto);
  }
}
