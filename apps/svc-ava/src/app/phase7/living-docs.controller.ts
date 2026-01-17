import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LivingDocsService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { DocArtifactType } from '@hubblewave/instance-db';

interface GenerateDocsDto {
  artifactType: DocArtifactType;
  artifactId: string;
  artifactCode: string;
  context?: Record<string, unknown>;
}

@ApiTags('Phase 7 - Living Documentation System')
@ApiBearerAuth()
@Controller('api/phase7/docs')
@UseGuards(JwtAuthGuard)
export class LivingDocsController {
  constructor(
    private readonly docsService: LivingDocsService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate documentation for an artifact' })
  @ApiResponse({ status: 201, description: 'Documentation generated' })
  async generateDocs(
    @CurrentUser() _user: RequestUser,
    @Body() dto: GenerateDocsDto,
  ) {
    const doc = await this.docsService.generateForArtifact(
      dto.artifactType,
      dto.artifactId,
      dto.artifactCode,
      dto.context || {},
    );

    return { documentation: doc };
  }

  @Post('generate/collection/:id')
  @ApiOperation({ summary: 'Generate documentation for a collection' })
  @ApiResponse({ status: 201, description: 'Documentation generated' })
  async generateCollectionDocs(
    @CurrentUser() _user: RequestUser,
    @Param('id') collectionId: string,
  ) {
    const doc = await this.docsService.generateForCollection(collectionId);

    return { documentation: doc };
  }

  @Post('regenerate-all')
  @ApiOperation({ summary: 'Regenerate all documentation' })
  @ApiResponse({ status: 200, description: 'Regeneration started' })
  async regenerateAll(
    @CurrentUser() _user: RequestUser,
  ) {
    const count = await this.docsService.regenerateAll();
    return { count };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documentation' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchDocs(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.docsService.search(
      query,
      limit ? parseInt(limit, 10) : 20,
    );

    return { results };
  }

  @Get('artifact/:type/:id')
  @ApiOperation({ summary: 'Get documentation for a specific artifact' })
  @ApiResponse({ status: 200, description: 'Documentation for artifact' })
  async getArtifactDoc(
    @Param('type') artifactType: DocArtifactType,
    @Param('id') artifactId: string,
  ) {
    const doc = await this.docsService.getDocumentation(
      artifactType,
      artifactId,
    );

    return { documentation: doc };
  }

  @Get('artifact/:type/code/:code')
  @ApiOperation({ summary: 'Get documentation by artifact code' })
  @ApiResponse({ status: 200, description: 'Documentation for artifact' })
  async getArtifactDocByCode(
    @Param('type') artifactType: DocArtifactType,
    @Param('code') artifactCode: string,
  ) {
    const doc = await this.docsService.getDocumentationByCode(
      artifactType,
      artifactCode,
    );

    return { documentation: doc };
  }

  @Get('artifact/:type/:id/versions')
  @ApiOperation({ summary: 'Get documentation version history' })
  @ApiResponse({ status: 200, description: 'Version history' })
  async getVersionHistory(
    @Param('type') artifactType: DocArtifactType,
    @Param('id') artifactId: string,
  ) {
    const doc = await this.docsService.getDocumentation(artifactType, artifactId);
    if (!doc) {
      return { versions: [] };
    }
    const versions = await this.docsService.getVersionHistory(doc.id);
    return { versions };
  }

  @Get('artifact/:type/:id/export')
  @ApiOperation({ summary: 'Export documentation to markdown' })
  @ApiResponse({ status: 200, description: 'Markdown content' })
  async exportToMarkdown(
    @Param('type') artifactType: DocArtifactType,
    @Param('id') artifactId: string,
  ) {
    const markdown = await this.docsService.exportToMarkdown(artifactType, artifactId);
    return { markdown };
  }
}
