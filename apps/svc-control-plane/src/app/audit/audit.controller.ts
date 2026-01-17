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

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: AuditLogQueryParams) {
    return this.auditService.findAll(query);
  }

  @Get('stats')
  async getStats(@Query('customerId') customerId?: string) {
    return this.auditService.getStats(customerId);
  }

  @Get('recent')
  async getRecentActivity(
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getRecentActivity(customerId, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateAuditLogDto) {
    return this.auditService.create(dto);
  }
}
