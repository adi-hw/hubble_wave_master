import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NLQueryService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface ExecuteQueryDto {
  query: string;
}

interface SaveQueryDto {
  name: string;
  query: string;
}

@ApiTags('Phase 7 - Natural Language Queries')
@ApiBearerAuth()
@Controller('api/phase7/nl-query')
@UseGuards(JwtAuthGuard)
export class NLQueryController {
  constructor(
    private readonly nlQueryService: NLQueryService,
  ) {}

  @Post('execute')
  @ApiOperation({ summary: 'Execute a natural language query' })
  @ApiResponse({ status: 200, description: 'Query results' })
  async executeQuery(
    @CurrentUser() user: RequestUser,
    @Body() dto: ExecuteQueryDto,
  ) {
    const result = await this.nlQueryService.executeQuery(
      dto.query,
      user.id,
    );

    // Transform to match frontend NLQueryResult type
    return {
      queryId: result.query.id,
      naturalLanguage: result.query.queryText,
      generatedSQL: result.query.generatedSql,
      results: result.results || [],
      rowCount: result.query.resultCount || 0,
      executionTime: result.query.executionTimeMs || 0,
      explanation: (result.query.parsedIntent as { explanation?: string })?.explanation,
      error: result.error,
    };
  }

  @Post('explain')
  @ApiOperation({ summary: 'Explain how a query will be processed' })
  @ApiResponse({ status: 200, description: 'Query explanation' })
  async explainQuery(
    @Body() dto: { query: string },
  ) {
    const explanation = await this.nlQueryService.explainQuery(dto.query);
    return { explanation };
  }

  @Post('suggest')
  @ApiOperation({ summary: 'Get query suggestions' })
  @ApiResponse({ status: 200, description: 'Query suggestions' })
  async suggestQueries(
    @Body() dto: { currentCollection?: string; recentQueries?: string[] },
  ) {
    const suggestions = await this.nlQueryService.suggestQueries({
      currentCollection: dto.currentCollection,
      recentQueries: dto.recentQueries,
    });

    return { suggestions };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get query history' })
  @ApiResponse({ status: 200, description: 'Query history' })
  async getHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const queries = await this.nlQueryService.getQueryHistory(
      user.id,
      limit ? parseInt(limit, 10) : 50,
    );

    // Transform to match frontend NLQueryResult type
    const history = queries.map(q => ({
      queryId: q.id,
      naturalLanguage: q.queryText,
      generatedSQL: q.generatedSql,
      results: [],
      rowCount: q.resultCount || 0,
      executionTime: q.executionTimeMs || 0,
      explanation: (q.parsedIntent as { explanation?: string })?.explanation,
    }));

    return { history };
  }

  @Post('save')
  @ApiOperation({ summary: 'Save a query for later use' })
  @ApiResponse({ status: 201, description: 'Query saved' })
  async saveQuery(
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveQueryDto,
  ) {
    const saved = await this.nlQueryService.saveQuery(
      user.id,
      dto.name,
      dto.query,
    );

    return { saved };
  }

  @Get('saved')
  @ApiOperation({ summary: 'Get saved queries' })
  @ApiResponse({ status: 200, description: 'Saved queries' })
  async getSavedQueries(
    @CurrentUser() user: RequestUser,
  ) {
    const queries = await this.nlQueryService.getSavedQueries(user.id);

    return { queries };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite queries' })
  @ApiResponse({ status: 200, description: 'Favorite queries' })
  async getFavoriteQueries(
    @CurrentUser() user: RequestUser,
  ) {
    const favorites = await this.nlQueryService.getFavoriteQueries(user.id);
    return { favorites };
  }

  @Get('examples')
  @ApiOperation({ summary: 'Get example queries by category' })
  @ApiResponse({ status: 200, description: 'Example queries' })
  async getExamples() {
    const categorizedExamples = await this.nlQueryService.getExamples();
    // Flatten categories into a single array for frontend compatibility
    const examples = categorizedExamples.flatMap(cat => cat.examples);
    return { examples };
  }

  @Post('saved/:id/favorite')
  @ApiOperation({ summary: 'Toggle favorite status of a saved query' })
  @ApiResponse({ status: 200, description: 'Query favorite status toggled' })
  async toggleFavorite(
    @Param('id') queryId: string,
  ) {
    const query = await this.nlQueryService.toggleFavorite(queryId);
    return { query };
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved query' })
  @ApiResponse({ status: 200, description: 'Query deleted' })
  async deleteSavedQuery(
    @Param('id') queryId: string,
  ) {
    await this.nlQueryService.deleteSavedQuery(queryId);
    return { success: true };
  }

  @Post('saved/:id/increment-usage')
  @ApiOperation({ summary: 'Increment usage count for a saved query' })
  @ApiResponse({ status: 200, description: 'Usage count incremented' })
  async incrementUsage(
    @Param('id') queryId: string,
  ) {
    await this.nlQueryService.incrementUsage(queryId);
    return { success: true };
  }
}
