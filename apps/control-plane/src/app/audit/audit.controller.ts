import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuditService, CreateAuditLogDto, AuditLogQueryParams } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — control-plane audit log surface. Reads
 * gated by `control_plane:audit:read`; out-of-band log appends gated
 * by `control_plane:audit:manage` and additionally constrained to
 * `super_admin` via the role hierarchy (a synthetic audit-log write
 * is high-blast and exists for incident-response use only).
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('control_plane:audit:read')
  async findAll(@Query() query: AuditLogQueryParams) {
    return this.auditService.findAll(query);
  }

  @Get('stats')
  @RequirePermission('control_plane:audit:read')
  async getStats(@Query('customerId') customerId?: string) {
    return this.auditService.getStats(customerId);
  }

  @Get('recent')
  @RequirePermission('control_plane:audit:read')
  async getRecentActivity(
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getRecentActivity(customerId, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @RequirePermission('control_plane:audit:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.findOne(id);
  }

  @Post()
  @RequirePermission('control_plane:audit:manage')
  @Roles('super_admin')
  async create(@Body() dto: CreateAuditLogDto) {
    return this.auditService.create(dto);
  }
}
