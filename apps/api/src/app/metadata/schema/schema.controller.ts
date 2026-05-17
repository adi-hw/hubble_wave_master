import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { SchemaDiffService } from './schema-diff.service';
import { SchemaDeployService } from './schema-deploy.service';

type SchemaRequest = {
  schema?: string;
  collectionCodes?: string[];
};

/**
 * Canon §28 / W2 Stream 3 — schema diff + deploy surface. Reading the
 * plan is `metadata:collection:read`; applying it mutates the platform
 * data model and requires `metadata:collection:manage`.
 */
@Controller('schema')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchemaController {
  constructor(
    private readonly diffService: SchemaDiffService,
    private readonly deployService: SchemaDeployService,
  ) {}

  @Get('plan')
  @RequirePermission('metadata:collection:read')
  getPlan(
    @Query('schema') schema?: string,
    @Query('collectionCodes') collectionCodes?: string,
    @Query('source') source?: string,
    @Query('includeDraft') includeDraft?: string,
  ) {
    return this.diffService.buildPlan({
      schema,
      collectionCodes: this.parseCollectionCodes(collectionCodes),
      includeDraft: source === 'draft' || includeDraft === 'true',
    });
  }

  @Post('deploy')
  @RequirePermission('metadata:collection:manage')
  deployPlan(
    @Body() body: SchemaRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.deployService.applyPlan({
      schema: body.schema,
      collectionCodes: body.collectionCodes,
    }, user?.id);
  }

  private parseCollectionCodes(raw?: string): string[] | undefined {
    if (!raw) {
      return undefined;
    }
    const codes = raw.split(',').map((value) => value.trim()).filter(Boolean);
    return codes.length > 0 ? codes : undefined;
  }
}
