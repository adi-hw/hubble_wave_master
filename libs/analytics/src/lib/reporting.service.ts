import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Report } from '@hubblewave/instance-db';

export interface RunReportRequest {
  reportId: string;
  parameters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  format?: 'json' | 'csv' | 'pdf' | 'excel';
}

export interface ReportResult {
  reportId: string;
  reportName: string;
  columns: ReportResultColumn[];
  data: Record<string, unknown>[];
  totals?: Record<string, number>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  generatedAt: Date;
  executionTime: number;
}

export interface ReportResultColumn {
  id: string;
  label: string;
  dataType: string;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

export interface ExportResult {
  content: Buffer | string;
  contentType: string;
  filename: string;
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  /**
   * Run a report and return results
   */
  async runReport(request: RunReportRequest): Promise<ReportResult> {
    const startTime = Date.now();

    const report = await this.reportRepo.findOne({
      where: { id: request.reportId },
    });

    if (!report) {
      throw new Error(`Report not found: ${request.reportId}`);
    }

    // Build and execute query based on report definition
    const { columns, data, totals } = await this.executeReportQuery(
      report,
      request.parameters || {},
      request.page || 1,
      request.pageSize || 50
    );

    const executionTime = Date.now() - startTime;

    return {
      reportId: report.id,
      reportName: report.label,
      columns,
      data,
      totals,
      pagination: {
        page: request.page || 1,
        pageSize: request.pageSize || 50,
        total: data.length,
        totalPages: Math.ceil(data.length / (request.pageSize || 50)),
      },
      generatedAt: new Date(),
      executionTime,
    };
  }

  /**
   * Export report to various formats
   */
  async exportReport(request: RunReportRequest): Promise<ExportResult> {
    const result = await this.runReport({ ...request, pageSize: 10000 });

    switch (request.format) {
      case 'csv':
        return this.exportToCsv(result);
      case 'pdf':
        return this.exportToPdf(result);
      case 'excel':
        return this.exportToExcel(result);
      default:
        return this.exportToJson(result);
    }
  }

  /**
   * Execute the report query
   */
  private async executeReportQuery(
    report: Report,
    parameters: Record<string, unknown>,
    page: number,
    pageSize: number
  ): Promise<{
    columns: ReportResultColumn[];
    data: Record<string, unknown>[];
    totals?: Record<string, number>;
  }> {
    // Build columns from report definition
    const columns: ReportResultColumn[] = (report.columns || []).map((col) => ({
      id: col.id,
      label: col.label,
      dataType: this.inferDataType(col),
      align: col.align,
      format: col.format,
    }));

    // Build query based on data source type
    let data: Record<string, unknown>[] = [];
    let totals: Record<string, number> | undefined;

    if (report.dataSource.type === 'collection') {
      const collectionCode = report.dataSource.collectionIds?.[0];
      if (!collectionCode) {
        return { columns, data: [], totals: undefined };
      }

      // Build dynamic query
      const queryBuilder = this.dataSource
        .createQueryBuilder()
        .from(collectionCode, 'record');

      // Apply column selections
      const selectColumns = (report.columns || [])
        .filter((col) => col.visible !== false)
        .map((col) => `record.${col.propertyCode} as "${col.id}"`);

      if (selectColumns.length > 0) {
        queryBuilder.select(selectColumns);
      }

      // Apply filters
      if (report.filters && report.filters.length > 0) {
        report.filters.forEach((filter, index) => {
          const paramName = `param${index}`;
          let value = filter.value;

          // Check if this is a parameter reference
          if (typeof value === 'string' && value.startsWith('$')) {
            const paramKey = value.substring(1);
            value = parameters[paramKey];
          }

          const clause = this.buildFilterClause(`record.${filter.field}`, filter.operator, paramName);
          if (index === 0) {
            queryBuilder.where(clause, { [paramName]: value });
          } else if (filter.conjunction === 'or') {
            queryBuilder.orWhere(clause, { [paramName]: value });
          } else {
            queryBuilder.andWhere(clause, { [paramName]: value });
          }
        });
      }

      // Apply sorting
      if (report.sorting && report.sorting.length > 0) {
        report.sorting.forEach((sort) => {
          queryBuilder.addOrderBy(`record.${sort.field}`, sort.direction.toUpperCase() as 'ASC' | 'DESC');
        });
      }

      // Apply grouping
      if (report.grouping && report.grouping.fields.length > 0) {
        report.grouping.fields.forEach((field) => {
          queryBuilder.addGroupBy(`record.${field}`);
        });
      }

      // Apply pagination
      queryBuilder.skip((page - 1) * pageSize).take(pageSize);

      // Execute query
      data = await queryBuilder.getRawMany();

      // Calculate totals if needed
      if (report.grouping?.showGrandTotal) {
        totals = await this.calculateTotals(report);
      }
    } else if (report.dataSource.type === 'query' && report.dataSource.customQuery) {
      // Execute custom SQL (with parameter substitution)
      const query = this.substituteParameters(report.dataSource.customQuery, parameters);
      data = await this.dataSource.query(query);
    }

    return { columns, data, totals };
  }

  /**
   * Build filter clause based on operator
   */
  private buildFilterClause(field: string, operator: string, paramName: string): string {
    switch (operator) {
      case 'equals':
        return `${field} = :${paramName}`;
      case 'not_equals':
        return `${field} != :${paramName}`;
      case 'contains':
        return `${field} LIKE :${paramName}`;
      case 'starts_with':
        return `${field} LIKE :${paramName}`;
      case 'ends_with':
        return `${field} LIKE :${paramName}`;
      case 'greater_than':
        return `${field} > :${paramName}`;
      case 'less_than':
        return `${field} < :${paramName}`;
      case 'greater_or_equal':
        return `${field} >= :${paramName}`;
      case 'less_or_equal':
        return `${field} <= :${paramName}`;
      case 'is_null':
        return `${field} IS NULL`;
      case 'is_not_null':
        return `${field} IS NOT NULL`;
      case 'in':
        return `${field} IN (:...${paramName})`;
      default:
        return `${field} = :${paramName}`;
    }
  }

  /**
   * Substitute parameters in SQL query
   */
  private substituteParameters(query: string, parameters: Record<string, unknown>): string {
    let result = query;
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `\${${key}}`;
      const sanitizedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sanitizedValue);
    }
    return result;
  }

  /**
   * Calculate totals for aggregatable columns
   */
  private async calculateTotals(
    report: Report
  ): Promise<Record<string, number>> {
    const totals: Record<string, number> = {};
    const collectionCode = report.dataSource.collectionIds?.[0];

    if (!collectionCode) return totals;

    const aggregateColumns = (report.columns || []).filter((col) => col.aggregate);

    if (aggregateColumns.length === 0) return totals;

    const aggregateSelects = aggregateColumns.map((col) => {
      switch (col.aggregate) {
        case 'sum':
          return `SUM(${col.propertyCode}) as "${col.id}"`;
        case 'avg':
          return `AVG(${col.propertyCode}) as "${col.id}"`;
        case 'min':
          return `MIN(${col.propertyCode}) as "${col.id}"`;
        case 'max':
          return `MAX(${col.propertyCode}) as "${col.id}"`;
        case 'count':
          return `COUNT(${col.propertyCode}) as "${col.id}"`;
        default:
          return `SUM(${col.propertyCode}) as "${col.id}"`;
      }
    });

    const result = await this.dataSource
      .createQueryBuilder()
      .select(aggregateSelects)
      .from(collectionCode, 'record')
      .getRawOne();

    if (result) {
      for (const col of aggregateColumns) {
        totals[col.id] = Number(result[col.id]) || 0;
      }
    }

    return totals;
  }

  /**
   * Infer data type from column definition
   */
  private inferDataType(column: { propertyCode: string; format?: string }): string {
    if (column.format?.includes('currency')) return 'currency';
    if (column.format?.includes('percent')) return 'percent';
    if (column.format?.includes('date')) return 'date';
    if (column.format?.includes('datetime')) return 'datetime';
    return 'string';
  }

  /**
   * Export to JSON
   */
  private exportToJson(result: ReportResult): ExportResult {
    return {
      content: JSON.stringify(result, null, 2),
      contentType: 'application/json',
      filename: `${result.reportName.replace(/\s+/g, '_')}_${Date.now()}.json`,
    };
  }

  /**
   * Export to CSV
   */
  private exportToCsv(result: ReportResult): ExportResult {
    const headers = result.columns.map((col) => `"${col.label}"`).join(',');
    const rows = result.data.map((row) =>
      result.columns
        .map((col) => {
          const value = row[col.id];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return String(value);
        })
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');

    return {
      content: csv,
      contentType: 'text/csv',
      filename: `${result.reportName.replace(/\s+/g, '_')}_${Date.now()}.csv`,
    };
  }

  /**
   * Export to PDF (placeholder - would use pdfmake or similar)
   */
  private exportToPdf(result: ReportResult): ExportResult {
    // In production, use pdfmake or puppeteer to generate PDF
    this.logger.warn('PDF export not implemented, returning JSON');
    return this.exportToJson(result);
  }

  /**
   * Export to Excel (placeholder - would use exceljs or similar)
   */
  private exportToExcel(result: ReportResult): ExportResult {
    // In production, use exceljs to generate XLSX
    this.logger.warn('Excel export not implemented, returning CSV');
    return this.exportToCsv(result);
  }

  /**
   * Get available reports for a tenant
   */
  async getReports(moduleId?: string): Promise<Report[]> {
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (moduleId) {
      where['moduleId'] = moduleId;
    }

    return this.reportRepo.find({
      where,
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  /**
   * Get a single report definition
   */
  async getReport(reportId: string): Promise<Report | null> {
    return this.reportRepo.findOne({
      where: { id: reportId },
    });
  }
}


