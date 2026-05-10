import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ReportingService } from './reporting.service';
import { Report } from './analytics-entities';

/**
 * F124 (W1 task 5) regression test — the dataSource.type='query' branch
 * was a SQL-injection vector via string-substituted parameters. The
 * branch is removed; this spec asserts it stays removed by demanding
 * any report with type='query' is rejected at runtime with a clear
 * F124-citing error AND that the underlying dataSource.query is
 * never invoked even with adversarial parameters.
 */
describe('ReportingService — F124 raw-SQL branch removed', () => {
  let service: ReportingService;
  let queryMock: jest.Mock;
  let reportRepoMock: { findOne: jest.Mock };

  function makeReport(overrides: Partial<Report> = {}): Report {
    return {
      id: overrides.id ?? 'report-with-raw-sql',
      code: 'legacy-raw-sql',
      label: 'Legacy raw SQL report',
      dataSource: {
        type: 'query',
        customQuery: "SELECT * FROM users WHERE id = ${userId}",
      },
      columns: [],
      sortOrder: 0,
      isActive: true,
      ...overrides,
    } as Report;
  }

  beforeEach(async () => {
    queryMock = jest.fn();
    const dsMock = {
      query: queryMock,
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    } as unknown as DataSource;

    reportRepoMock = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: getRepositoryToken(Report), useValue: reportRepoMock },
        { provide: getDataSourceToken(), useValue: dsMock },
      ],
    }).compile();

    service = module.get(ReportingService);
  });

  it('rejects a report with dataSource.type="query"', async () => {
    const report = makeReport();
    reportRepoMock.findOne.mockResolvedValue(report);

    await expect(
      service.runReport({
        reportId: report.id,
        parameters: { userId: '1; DROP TABLE users--' },
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(/F124/);

    // Critical: the underlying dataSource.query MUST NOT be invoked.
    // Without this assertion, a regression that just changes the error
    // message could still let the SQL through.
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('error message names the report id and the migration path', async () => {
    const report = makeReport({ id: 'r-id-42' });
    reportRepoMock.findOne.mockResolvedValue(report);

    let captured: Error | null = null;
    try {
      await service.runReport({
        reportId: 'r-id-42',
        parameters: {},
        page: 1,
        pageSize: 10,
      });
    } catch (e) {
      captured = e as Error;
    }

    expect(captured).not.toBeNull();
    expect(captured!.message).toContain('r-id-42');
    expect(captured!.message).toContain("type='collection'");
    expect(captured!.message).toContain('F124');
  });

  it('rejects regardless of customQuery value (even empty)', async () => {
    // The previous branch guard was `type === 'query' && customQuery`.
    // The new code rejects on type alone — empty/undefined customQuery
    // also fails (catches the case where someone clears the SQL but
    // leaves the type set, which would have silently hit the next
    // branch in the if/else and returned an empty result before).
    const report = makeReport({
      dataSource: { type: 'query' },
    });
    reportRepoMock.findOne.mockResolvedValue(report);

    await expect(
      service.runReport({
        reportId: report.id,
        parameters: {},
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(/F124/);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
