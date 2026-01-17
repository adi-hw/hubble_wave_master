import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AIReportsService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ReportFormat, ReportStatus } from '@hubblewave/instance-db';

interface GenerateReportDto {
  prompt: string;
  format?: ReportFormat;
}

interface CreateTemplateDto {
  name: string;
  description?: string;
  category?: string;
  basePrompt?: string;
  schemaHints?: Record<string, unknown>;
  chartPreferences?: Record<string, unknown>;
  isPublic?: boolean;
}

@ApiTags('Phase 7 - AI Report Generator')
@ApiBearerAuth()
@Controller('api/phase7/reports')
@UseGuards(JwtAuthGuard)
export class AIReportsController {
  constructor(
    private readonly reportsService: AIReportsService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an AI-powered report' })
  @ApiResponse({ status: 201, description: 'Report generated' })
  async generateReport(
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateReportDto,
  ) {
    const report = await this.reportsService.generateReport(
      dto.prompt,
      user.id,
      dto.format,
    );

    return { report };
  }

  @Get()
  @ApiOperation({ summary: 'List generated reports' })
  @ApiResponse({ status: 200, description: 'List of reports' })
  async listReports(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.reportsService.listReports({
      userId: user.id,
      status: status as ReportStatus,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return { reports: result.data, total: result.total };
  }

  @Get('templates')
  @ApiOperation({ summary: 'List report templates' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async getTemplates(
    @CurrentUser() user: RequestUser,
    @Query('category') category?: string,
    @Query('includeShared') includeShared?: string,
    @Query('isPublic') isPublic?: string,
  ) {
    const result = await this.reportsService.listTemplates({
      userId: user.id,
      category,
      isPublic: includeShared === 'true' || isPublic === 'true' ? true : undefined,
    });

    return { templates: result.data, total: result.total };
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a report template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTemplateDto,
  ) {
    const template = await this.reportsService.createTemplate({
      ...dto,
      createdBy: user.id,
    });

    return { template };
  }

  @Get('templates/list')
  @ApiOperation({ summary: 'List report templates' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async listTemplates(
    @CurrentUser() user: RequestUser,
    @Query('category') category?: string,
    @Query('isPublic') isPublic?: string,
  ) {
    const result = await this.reportsService.listTemplates({
      userId: user.id,
      category,
      isPublic: isPublic === 'true' ? true : undefined,
    });

    return { templates: result.data, total: result.total };
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template details' })
  @ApiResponse({ status: 200, description: 'Template details' })
  async getTemplate(
    @Param('id') templateId: string,
  ) {
    const template = await this.reportsService.getTemplate(templateId);
    return { template };
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  async updateTemplate(
    @Param('id') templateId: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    const template = await this.reportsService.updateTemplate(templateId, dto);
    return { template };
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  async deleteTemplate(
    @Param('id') templateId: string,
  ) {
    await this.reportsService.deleteTemplate(templateId);
    return { success: true };
  }

  @Post('templates/:id/generate')
  @ApiOperation({ summary: 'Generate report from template' })
  @ApiResponse({ status: 201, description: 'Report generated' })
  async generateFromTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') templateId: string,
    @Body() dto: { variables?: Record<string, string> },
  ) {
    const report = await this.reportsService.generateFromTemplate(
      templateId,
      user.id,
      dto.variables,
    );

    return { report };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report details' })
  @ApiResponse({ status: 200, description: 'Report details' })
  async getReport(
    @Param('id') reportId: string,
  ) {
    const report = await this.reportsService.getReport(reportId);
    return { report };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report' })
  @ApiResponse({ status: 200, description: 'Report deleted' })
  async deleteReport(
    @Param('id') reportId: string,
  ) {
    await this.reportsService.deleteReport(reportId);
    return { success: true };
  }

  @Get(':id/export/:format')
  @ApiOperation({ summary: 'Export report in specified format' })
  @ApiResponse({ status: 200, description: 'Exported report' })
  async exportReport(
    @Param('id') reportId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportReport(reportId, format as ReportFormat);

    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      html: 'text/html',
      json: 'application/json',
    };

    res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.${format}"`);
    res.send(result);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate an existing report' })
  @ApiResponse({ status: 200, description: 'Report regenerated' })
  async regenerateReport(
    @Param('id') reportId: string,
    @Body() dto: { format?: ReportFormat },
  ) {
    const report = await this.reportsService.regenerateReport(reportId, dto.format);
    return { report };
  }
}
