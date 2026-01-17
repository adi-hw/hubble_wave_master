import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { LocalizationService, PublishLocalizationRequest } from './localization.service';
import { LocalizationRequestService, CreateTranslationRequest } from './localization-request.service';
import {
  LocalizationStudioService,
  UpdateTranslationRequest,
  UpdateTranslationValue,
  UpsertTranslationValue,
} from './localization-studio.service';

@Controller('localization')
@UseGuards(JwtAuthGuard)
export class LocalizationController {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly requestService: LocalizationRequestService,
    private readonly studioService: LocalizationStudioService,
  ) {}

  @Post('publish')
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
  async upsertValue(
    @Body() body: UpsertTranslationValue,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.studioService.upsertValue(body, user?.id);
  }

  @Patch('values/:id')
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
