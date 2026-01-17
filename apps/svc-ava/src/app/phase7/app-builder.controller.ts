import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AppBuilderService } from '@hubblewave/ai';
import { AppStatus } from '@hubblewave/instance-db';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface GenerateAppDto {
  description: string;
  options?: {
    style?: 'minimal' | 'standard' | 'comprehensive';
    targetUsers?: string;
  };
}

interface RefineAppDto {
  refinement: string;
}

@ApiTags('Phase 7 - Zero-Code App Builder')
@ApiBearerAuth()
@Controller('api/phase7/app-builder')
@UseGuards(JwtAuthGuard)
export class AppBuilderController {
  constructor(
    private readonly appBuilderService: AppBuilderService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an app from natural language description' })
  @ApiResponse({ status: 201, description: 'App generated' })
  async generateApp(
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateAppDto,
  ) {
    const result = await this.appBuilderService.generateAppFromDescription(
      user.id,
      dto.description,
      dto.options,
    );

    return result;
  }

  @Get('apps')
  @ApiOperation({ summary: 'List user apps' })
  @ApiResponse({ status: 200, description: 'List of apps' })
  async listApps(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const apps = await this.appBuilderService.listApps(
      user.id,
      status ? { status: status as AppStatus } : undefined,
    );

    return { apps };
  }

  @Get('apps/:id')
  @ApiOperation({ summary: 'Get app details' })
  @ApiResponse({ status: 200, description: 'App details' })
  async getApp(
    @Param('id') appId: string,
  ) {
    const app = await this.appBuilderService.getApp(appId);
    return { app };
  }

  @Put('apps/:id/refine')
  @ApiOperation({ summary: 'Refine app with additional requirements' })
  @ApiResponse({ status: 200, description: 'App refined' })
  async refineApp(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Body() dto: RefineAppDto,
  ) {
    const spec = await this.appBuilderService.refineApp(
      appId,
      user.id,
      dto.refinement,
    );

    return { spec };
  }

  @Post('apps/:id/build')
  @ApiOperation({ summary: 'Build and deploy the app' })
  @ApiResponse({ status: 200, description: 'App build started' })
  async buildApp(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
  ) {
    const result = await this.appBuilderService.buildApp(appId, user.id);
    return result;
  }

  @Delete('apps/:id')
  @ApiOperation({ summary: 'Delete an app' })
  @ApiResponse({ status: 200, description: 'App deleted' })
  async deleteApp(
    @Param('id') appId: string,
  ) {
    await this.appBuilderService.deleteApp(appId);
    return { success: true };
  }

  @Post('apps/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate an app' })
  @ApiResponse({ status: 201, description: 'App duplicated' })
  async duplicateApp(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Body() dto: { newName: string },
  ) {
    const app = await this.appBuilderService.duplicateApp(
      appId,
      user.id,
      dto.newName,
    );

    return { app };
  }

  @Get('apps/:id/versions')
  @ApiOperation({ summary: 'Get app version history' })
  @ApiResponse({ status: 200, description: 'Version history' })
  async getVersionHistory(
    @Param('id') appId: string,
  ) {
    const versions = await this.appBuilderService.getVersionHistory(appId);
    return { versions };
  }

  @Post('apps/:id/rollback/:versionId')
  @ApiOperation({ summary: 'Rollback to a specific version' })
  @ApiResponse({ status: 200, description: 'App rolled back' })
  async rollbackToVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Param('versionId') versionId: string,
  ) {
    const spec = await this.appBuilderService.rollbackToVersion(
      appId,
      versionId,
      user.id,
    );

    return { spec };
  }

  @Get('apps/:id/export')
  @ApiOperation({ summary: 'Export app configuration' })
  @ApiResponse({ status: 200, description: 'App export' })
  async exportApp(
    @Param('id') appId: string,
  ) {
    const exported = await this.appBuilderService.exportApp(appId);
    return exported;
  }

  @Get('components')
  @ApiOperation({ summary: 'Get available app builder components' })
  @ApiResponse({ status: 200, description: 'List of components' })
  async getComponents() {
    const components = await this.appBuilderService.getAvailableComponents();
    return { components };
  }
}
