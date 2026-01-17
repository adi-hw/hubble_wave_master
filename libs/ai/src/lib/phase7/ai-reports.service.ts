import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AIReport,
  AIReportTemplate,
  ReportStatus,
  ReportFormat,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

const REPORT_GENERATION_PROMPT = `You are an intelligent report generator for an enterprise platform.

Given a natural language description of a report, analyze what data is needed and design the report structure.

Your response should include:
1. Report title
2. Data sources (which collections to query)
3. Columns to include with optional aggregations
4. Grouping and filtering criteria
5. Recommended chart types
6. Key insights to highlight

Output ONLY valid JSON:
{
  "title": "Report Title",
  "dataSource": {
    "collections": ["collection1", "collection2"],
    "query": { "filter": {}, "joins": [] }
  },
  "columns": [
    { "property": "field_code", "aggregate": null },
    { "property": "amount", "aggregate": "sum" }
  ],
  "groupBy": ["category"],
  "charts": [
    { "type": "bar", "title": "Chart Title", "config": {} }
  ],
  "insights": ["Key insight 1", "Key insight 2"]
}`;

@Injectable()
export class AIReportsService {
  private readonly logger = new Logger(AIReportsService.name);

  constructor(
    @InjectRepository(AIReport)
    private readonly reportRepo: Repository<AIReport>,
    @InjectRepository(AIReportTemplate)
    private readonly templateRepo: Repository<AIReportTemplate>,
    private readonly llmService: LLMService,
  ) {}

  async generateReport(prompt: string, userId: string, format?: ReportFormat): Promise<AIReport> {
    const startTime = Date.now();

    const report = this.reportRepo.create({
      prompt,
      generatedBy: userId,
      format: format || 'html',
      status: 'pending' as ReportStatus,
      definition: {} as AIReport['definition'],
    });

    await this.reportRepo.save(report);

    try {
      report.status = 'generating';
      await this.reportRepo.save(report);

      const definition = await this.analyzeReportRequest(prompt);
      report.title = definition.title;
      report.definition = definition as AIReport['definition'];
      report.parsedIntent = definition as unknown as Record<string, unknown>;

      // Generate the actual report (in a real implementation)
      // const fileUrl = await this.renderReport(report, format);
      // report.generatedFileUrl = fileUrl;

      report.status = 'completed';
      report.generationTimeMs = Date.now() - startTime;
    } catch (error) {
      report.status = 'failed';
      report.generationTimeMs = Date.now() - startTime;
      this.logger.error(`Failed to generate report: ${(error as Error).message}`);
    }

    return this.reportRepo.save(report);
  }

  private async analyzeReportRequest(prompt: string): Promise<AIReport['definition'] & { title: string }> {
    const response = await this.llmService.complete(
      `Generate a report definition for: ${prompt}`,
      REPORT_GENERATION_PROMPT,
    );

    try {
      return JSON.parse(response);
    } catch {
      return {
        title: 'Custom Report',
        dataSource: { collections: [] },
        columns: [],
      };
    }
  }

  async getReport(id: string): Promise<AIReport> {
    return this.reportRepo.findOneOrFail({
      where: { id },
      relations: ['generatedByUser'],
    });
  }

  async listReports(options: {
    userId?: string;
    status?: ReportStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AIReport[]; total: number }> {
    const query = this.reportRepo.createQueryBuilder('report')
      .leftJoinAndSelect('report.generatedByUser', 'user');

    if (options.userId) {
      query.andWhere('report.generatedBy = :userId', { userId: options.userId });
    }

    if (options.status) {
      query.andWhere('report.status = :status', { status: options.status });
    }

    const [data, total] = await query
      .orderBy('report.createdAt', 'DESC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async deleteReport(id: string): Promise<void> {
    await this.reportRepo.delete(id);
  }

  async regenerateReport(id: string, format?: ReportFormat): Promise<AIReport> {
    const report = await this.reportRepo.findOneOrFail({ where: { id } });
    const formatToUse = format ?? report.format ?? undefined;
    return this.generateReport(report.prompt, report.generatedBy!, formatToUse);
  }

  async exportReport(id: string, format: ReportFormat): Promise<string> {
    await this.reportRepo.findOneOrFail({ where: { id } });

    // In a real implementation, this would render the report to the specified format
    // and return the file URL

    return `/api/ai/reports/${id}/download?format=${format}`;
  }

  // Template Management

  async createTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    basePrompt?: string;
    schemaHints?: Record<string, unknown>;
    chartPreferences?: Record<string, unknown>;
    isPublic?: boolean;
    createdBy?: string;
  }): Promise<AIReportTemplate> {
    const template = this.templateRepo.create(data);
    return this.templateRepo.save(template);
  }

  async getTemplate(id: string): Promise<AIReportTemplate> {
    return this.templateRepo.findOneOrFail({ where: { id } });
  }

  async listTemplates(options: {
    category?: string;
    isPublic?: boolean;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AIReportTemplate[]; total: number }> {
    const query = this.templateRepo.createQueryBuilder('template');

    if (options.category) {
      query.andWhere('template.category = :category', { category: options.category });
    }

    if (options.isPublic !== undefined) {
      query.andWhere('template.isPublic = :isPublic', { isPublic: options.isPublic });
    }

    if (options.userId) {
      query.andWhere('(template.createdBy = :userId OR template.isPublic = true)', { userId: options.userId });
    }

    const [data, total] = await query
      .orderBy('template.name', 'ASC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    basePrompt: string;
    schemaHints: Record<string, unknown>;
    chartPreferences: Record<string, unknown>;
    isPublic: boolean;
  }>): Promise<AIReportTemplate> {
    const template = await this.templateRepo.findOneOrFail({ where: { id } });
    Object.assign(template, data);
    return this.templateRepo.save(template);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepo.delete(id);
  }

  async generateFromTemplate(templateId: string, userId: string, variables?: Record<string, string>): Promise<AIReport> {
    const template = await this.templateRepo.findOneOrFail({ where: { id: templateId } });

    let prompt = template.basePrompt || template.name;

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(`{{${key}}}`, value);
      }
    }

    return this.generateReport(prompt, userId);
  }
}
