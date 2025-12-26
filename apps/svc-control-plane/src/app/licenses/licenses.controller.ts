import { Controller, Get, Post, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { CreateLicenseDto, UpdateLicenseStatusDto, ValidateLicenseDto } from './licenses.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('licenses')
@Roles('operator')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get()
  async findAll(@Query('customerId') customerId?: string) {
    return this.licensesService.findAll(customerId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.licensesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateLicenseDto, @CurrentUser('id') userId: string) {
    return this.licensesService.create(dto, userId);
  }

  @Post(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLicenseStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.licensesService.updateStatus(id, dto, userId);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateLicenseDto) {
    return this.licensesService.validate(dto);
  }
}
