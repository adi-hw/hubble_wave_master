import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { SchemaDiffService } from './schema-diff.service';
import { SchemaDeployService } from './schema-deploy.service';

type SchemaRequest = {
  schema?: string;
  collectionCodes?: string[];
};

@Controller('schema')
@UseGuards(JwtAuthGuard)
export class SchemaController {
  constructor(
    private readonly diffService: SchemaDiffService,
    private readonly deployService: SchemaDeployService,
  ) {}

  @Get('plan')
  getPlan(
    @Query('schema') schema?: string,
    @Query('collectionCodes') collectionCodes?: string,
  ) {
    return this.diffService.buildPlan({
      schema,
      collectionCodes: this.parseCollectionCodes(collectionCodes),
    });
  }

  @Post('deploy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
