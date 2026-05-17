import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryParams } from './customers.dto';
import { CustomerSettingsDto } from './customer-settings.dto';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — control-plane customer registry. Reads
 * gated by `control_plane:customer:read`; mutations by
 * `control_plane:customer:manage` (dangerous — bumps to admin tier
 * via the PermissionsGuard hierarchy mapping).
 */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission('control_plane:customer:read')
  async findAll(@Query() query: CustomerQueryParams) {
    return this.customersService.findAll(query);
  }

  @Get('stats')
  @RequirePermission('control_plane:customer:read')
  async getStats() {
    return this.customersService.getStats();
  }

  @Get(':id')
  @RequirePermission('control_plane:customer:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Get('code/:code')
  @RequirePermission('control_plane:customer:read')
  async findByCode(@Param('code') code: string) {
    return this.customersService.findByCode(code);
  }

  @Post()
  @RequirePermission('control_plane:customer:manage')
  async create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  @RequirePermission('control_plane:customer:manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  @Patch(':id/settings')
  @RequirePermission('control_plane:customer:manage')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() settings: CustomerSettingsDto,
  ) {
    return this.customersService.updateSettings(id, settings);
  }

  @Delete(':id')
  @RequirePermission('control_plane:customer:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.delete(id);
  }
}
