import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService, CreateAuditLogDto, AuditLogQueryParams } from './audit.service';

@Controller('audit-logs')
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
