import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NLQuery,
  SavedNLQuery,
  CollectionDefinition,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

const SQL_GENERATION_PROMPT = `You are a SQL query generator for an enterprise platform.

Given a natural language question about data, generate a safe, read-only SQL query.

Rules:
1. ONLY generate SELECT statements
2. NEVER use DELETE, UPDATE, INSERT, DROP, ALTER, CREATE, TRUNCATE
3. Use proper table aliases
4. Include appropriate JOINs when needed
5. Add reasonable LIMIT clause (max 1000 rows)
6. Use parameterized placeholders for user inputs

Available collections/tables and their properties will be provided.

Output ONLY valid JSON:
{
  "sql": "SELECT ... FROM ... WHERE ... LIMIT 100",
  "explanation": "Brief explanation of what this query does",
  "confidence": 0.95,
  "collections_used": ["collection1", "collection2"],
  "parameters": {}
}`;

interface QueryResult {
  sql: string;
  explanation: string;
  confidence: number;
  collectionsUsed: string[];
  parameters: Record<string, unknown>;
}

@Injectable()
export class NLQueryService {
  constructor(
    @InjectRepository(NLQuery)
    private readonly queryRepo: Repository<NLQuery>,
    @InjectRepository(SavedNLQuery)
    private readonly savedQueryRepo: Repository<SavedNLQuery>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly llmService: LLMService,
  ) {}

  async executeQuery(queryText: string, userId?: string): Promise<{
    query: NLQuery;
    results?: unknown[];
    error?: string;
  }> {
    const startTime = Date.now();

    const query = this.queryRepo.create({
      userId,
      queryText,
    });

    try {
      const schema = await this.getSchemaContext();
      const generated = await this.generateSQL(queryText, schema);

      query.parsedIntent = generated as unknown as Record<string, unknown>;
      query.generatedSql = generated.sql;
      query.confidence = generated.confidence;

      if (!this.validateSQL(generated.sql)) {
        throw new Error('Generated SQL contains unsafe operations');
      }

      // Execute the query (in a real implementation)
      // const results = await this.runQuery(generated.sql, generated.parameters);
      const results: unknown[] = [];

      query.resultCount = results.length;
      query.executionTimeMs = Date.now() - startTime;

      await this.queryRepo.save(query);

      return { query, results };
    } catch (error) {
      query.errorMessage = (error as Error).message;
      query.executionTimeMs = Date.now() - startTime;
      await this.queryRepo.save(query);

      return { query, error: query.errorMessage };
    }
  }

  private async getSchemaContext(): Promise<string> {
    const collections = await this.collectionRepo.find({
      relations: ['properties'],
      take: 50,
    });

    const schema = collections.map(c => ({
      table: c.tableName,
      code: c.code,
      name: c.name,
      properties: c.properties?.map(p => ({
        column: p.columnName,
        code: p.code,
        name: p.name,
        type: p.propertyType?.code ?? p.propertyTypeId,
      })),
    }));

    return JSON.stringify(schema, null, 2);
  }

  private async generateSQL(queryText: string, schema: string): Promise<QueryResult> {
    const response = await this.llmService.complete(
      `Available schema:\n${schema}\n\nUser question: ${queryText}`,
      SQL_GENERATION_PROMPT,
    );

    try {
      const parsed = JSON.parse(response);
      return {
        sql: parsed.sql,
        explanation: parsed.explanation,
        confidence: parsed.confidence,
        collectionsUsed: parsed.collections_used || [],
        parameters: parsed.parameters || {},
      };
    } catch {
      throw new Error('Failed to generate valid SQL from natural language query');
    }
  }

  private validateSQL(sql: string): boolean {
    const upperSQL = sql.toUpperCase();
    const forbidden = ['DELETE', 'UPDATE', 'INSERT', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];

    for (const keyword of forbidden) {
      if (upperSQL.includes(keyword)) {
        return false;
      }
    }

    if (!upperSQL.trim().startsWith('SELECT')) {
      return false;
    }

    return true;
  }

  async getQueryHistory(userId: string, limit = 50): Promise<NLQuery[]> {
    return this.queryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async saveQuery(userId: string, name: string, queryText: string): Promise<SavedNLQuery> {
    const savedQuery = this.savedQueryRepo.create({
      userId,
      name,
      queryText,
      isFavorite: false,
      usageCount: 0,
    });
    return this.savedQueryRepo.save(savedQuery);
  }

  async getSavedQueries(userId: string): Promise<SavedNLQuery[]> {
    return this.savedQueryRepo.find({
      where: { userId },
      order: { usageCount: 'DESC', createdAt: 'DESC' },
    });
  }

  async getFavoriteQueries(userId: string): Promise<SavedNLQuery[]> {
    return this.savedQueryRepo.find({
      where: { userId, isFavorite: true },
      order: { usageCount: 'DESC' },
    });
  }

  async toggleFavorite(queryId: string): Promise<SavedNLQuery> {
    const query = await this.savedQueryRepo.findOneOrFail({ where: { id: queryId } });
    query.isFavorite = !query.isFavorite;
    return this.savedQueryRepo.save(query);
  }

  async deleteSavedQuery(queryId: string): Promise<void> {
    await this.savedQueryRepo.delete(queryId);
  }

  async incrementUsage(queryId: string): Promise<void> {
    await this.savedQueryRepo.increment({ id: queryId }, 'usageCount', 1);
  }

  async explainQuery(queryText: string): Promise<string> {
    const schema = await this.getSchemaContext();

    const response = await this.llmService.complete(
      `Schema:\n${schema}\n\nUser query: ${queryText}`,
      'You are a SQL query explainer. Explain in simple terms what data the user is asking for.',
    );

    return response;
  }

  async suggestQueries(context: {
    currentCollection?: string;
    recentQueries?: string[];
  }): Promise<string[]> {
    const suggestions: string[] = [];

    if (context.currentCollection) {
      suggestions.push(
        `Show all ${context.currentCollection}`,
        `Count ${context.currentCollection} by status`,
        `Show ${context.currentCollection} created this week`,
      );
    }

    if (context.recentQueries?.length) {
      // Suggest variations of recent queries
    }

    return suggestions;
  }

  async getExamples(): Promise<{ category: string; examples: { query: string; description: string }[] }[]> {
    return [
      {
        category: 'Basic Queries',
        examples: [
          { query: 'Show all open incidents', description: 'List all incidents with open status' },
          { query: 'Count users by department', description: 'Get user counts grouped by department' },
          { query: 'Show requests created today', description: 'List all requests created in the last 24 hours' },
        ],
      },
      {
        category: 'Aggregations',
        examples: [
          { query: 'Average resolution time for incidents', description: 'Calculate the average time to resolve incidents' },
          { query: 'Top 10 most assigned users', description: 'Show users with the most assigned records' },
          { query: 'Count records by status and priority', description: 'Get record counts grouped by status and priority' },
        ],
      },
      {
        category: 'Time-Based',
        examples: [
          { query: 'Show incidents from last week', description: 'List incidents created in the past 7 days' },
          { query: 'Count requests by month', description: 'Get monthly request counts' },
          { query: 'Show overdue tasks', description: 'List tasks past their due date' },
        ],
      },
    ];
  }
}
