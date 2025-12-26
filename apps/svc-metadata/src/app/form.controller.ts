import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { FormService } from './form.service';

@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Get()
  list() {
    return this.formService.listForms();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.formService.getForm(id);
  }

  @Post()
  create(@Body() body: { name: string; slug: string; description?: string; schema?: any; createdBy?: string }) {
    return this.formService.createForm({ ...body });
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() body: { schema: any; createdBy?: string }) {
    return this.formService.publishDraft(id, body.schema, body.createdBy);
  }
}
