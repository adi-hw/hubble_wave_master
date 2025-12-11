import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, TenantId } from '@eam-platform/auth-guard';
import { FormService } from './form.service';

@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.formService.listForms(tenantId);
  }

  @Get(':id')
  get(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.formService.getForm(id, tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() body: { name: string; slug: string; description?: string; schema?: any; createdBy?: string }) {
    return this.formService.createForm(tenantId, { ...body });
  }

  @Post(':id/publish')
  publish(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: { schema: any; createdBy?: string }) {
    return this.formService.publishDraft(tenantId, id, body.schema, body.createdBy);
  }
}
