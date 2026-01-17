import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { CreateWorkflowDefinitionRequest, UpdateWorkflowDefinitionRequest } from './workflow.types';

@Controller('workflows/definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WorkflowDefinitionsController {
  constructor(private readonly definitions: WorkflowDefinitionService) {}

  @Get()
  async list(
    @Query('collectionId') collectionId?: string,
    @Query('active') active?: string,
    @Query('code') code?: string,
  ) {
    return this.definitions.list({
      collectionId,
      code,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.definitions.getById(id);
  }

  @Post()
  async create(
    @Body() body: CreateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.create(body, user?.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.update(id, body, user?.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.delete(id, user?.id);
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.activate(id, user?.id);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.deactivate(id, user?.id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body() body: { code: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.duplicate(id, body.code, user?.id);
  }
}
