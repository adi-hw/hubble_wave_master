import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { LocalizationService, PublishLocalizationRequest } from './localization.service';
import { LocalizationRequestService, CreateTranslationRequest } from './localization-request.service';
import {
  LocalizationStudioService,
  UpdateTranslationRequest,
  UpdateTranslationValue,
  UpsertTranslationValue,
} from './localization-studio.service';

/**
 * Localization endpoints serve translation bundles, locales, keys, and values.
 *
 * Tenant scope: HubbleWave runs one instance per customer (Manifesto §5), so
 * "tenant" is implicit in the database itself. Translations are
 * instance-global — every translation row, every locale, and every key in
 * this database belongs to this customer instance and is shared by all of
 * its users. There is therefore no per-tenant filter applied here, and there
 * must not be one: introducing a tenantId column would constitute a
 * cross-customer data sharing model, which the architecture forbids.
 */
@Controller('localization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalizationController {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly requestService: LocalizationRequestService,
    private readonly studioService: LocalizationStudioService,
  ) {}

  @Post('publish')
  @Roles('admin')
  async publish(@Body() body: PublishLocalizationRequest, @CurrentUser() user?: RequestUser) {
    return this.localizationService.publishBundles(body || {}, user?.id);
  }

  @Get('bundles/:localeCode')
  async getBundle(@Param('localeCode') localeCode: string) {
    return this.localizationService.getBundle(localeCode);
  }

  @Post('requests')
  async requestTranslation(
    @Body() body: CreateTranslationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.requestService.createRequest(body, user?.id);
  }

  @Get('locales')
  async listLocales() {
    return this.studioService.listLocales();
  }

  @Get('keys')
  async listKeys(@Query('namespace') namespace?: string) {
    return this.studioService.listKeys(namespace);
  }

  @Get('values')
  async listValues(
    @Query('locale_code') localeCode?: string,
    @Query('namespace') namespace?: string,
  ) {
    if (!localeCode) {
      return [];
    }
    return this.studioService.listValues(localeCode, namespace);
  }

  @Post('values')
  @Roles('admin')
  async upsertValue(
    @Body() body: UpsertTranslationValue,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.studioService.upsertValue(body, user?.id);
  }

  @Patch('values/:id')
  @Roles('admin')
  async updateValue(
    @Param('id') id: string,
    @Body() body: UpdateTranslationValue,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.studioService.updateValue(id, body, user?.id);
  }

  @Get('requests')
  async listRequests(@Query('status') status?: string) {
    return this.studioService.listRequests(status);
  }

  @Patch('requests/:id')
  async updateRequest(
    @Param('id') id: string,
    @Body() body: UpdateTranslationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.studioService.updateRequest(id, body, user?.id);
  }
}
