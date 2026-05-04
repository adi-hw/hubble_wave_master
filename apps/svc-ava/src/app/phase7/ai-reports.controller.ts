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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AIReportsService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ReportFormat, ReportStatus } from '@hubblewave/instance-db';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const SUPPORTED_EXPORT_FORMATS: ReadonlySet<ReportFormat> = new Set<ReportFormat>([
  'pdf',
  'html',
  'xlsx',
  'json',
  'csv',
] as ReportFormat[]);

// Strict DOMPurify config: disallow scripting, frames, plugins, event
// handlers, javascript: URLs, and CSS injection vectors. Inline style is
// blocked for safety; report styling is delivered via the wrapper template.
const HTML_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
    'div', 'em', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'q', 's', 'small', 'span',
    'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'class'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'form', 'input', 'button'],
  FORBID_ATTR: ['style', 'srcdoc', 'formaction'],
  ALLOW_DATA_ATTR: false,
};

const purifierWindow = new JSDOM('').window;
const purifier = createDOMPurify(purifierWindow as unknown as Window & typeof globalThis);

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
@Controller('phase7/reports')
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
    @CurrentUser() user: RequestUser,
    @Param('id') templateId: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    // Ownership check: only the template creator (or admin) may update.
    const existing = await this.reportsService.getTemplate(templateId);
    if (existing.createdBy !== user.id && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    const template = await this.reportsService.updateTemplate(templateId, dto);
    return { template };
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  async deleteTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') templateId: string,
  ) {
    // Ownership check: only the template creator (or admin) may delete.
    const existing = await this.reportsService.getTemplate(templateId);
    if (existing.createdBy !== user.id && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
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
    @CurrentUser() user: RequestUser,
    @Param('id') reportId: string,
  ) {
    // Ownership check: only the user who generated the report (or admin) may delete it.
    const report = await this.reportsService.getReport(reportId);
    if (report.generatedBy !== user.id && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    await this.reportsService.deleteReport(reportId);
    return { success: true };
  }

  @Get(':id/export/:format')
  @ApiOperation({ summary: 'Export report in specified format' })
  @ApiResponse({ status: 200, description: 'Exported report' })
  async exportReport(
    @CurrentUser() user: RequestUser,
    @Param('id') reportId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ) {
    if (!SUPPORTED_EXPORT_FORMATS.has(format as ReportFormat)) {
      throw new BadRequestException(
        `Unsupported export format. Allowed: ${[...SUPPORTED_EXPORT_FORMATS].join(', ')}`,
      );
    }

    // Ownership check on export — reports may contain sensitive data.
    const report = await this.reportsService.getReport(reportId);
    if (report.generatedBy !== user.id && !user.roles?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }

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

    if (format === 'html') {
      // Sanitize LLM-generated HTML before sending. CSP locks the document down
      // even further so any latent script vector cannot execute.
      const raw = typeof result === 'string' ? result : String(result);
      const sanitized = purifier.sanitize(raw, HTML_SANITIZE_CONFIG);
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(sanitized);
      return;
    }

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
