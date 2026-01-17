import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import {
  CreateSearchDictionaryRequest,
  CreateSearchExperienceRequest,
  CreateSearchSourceRequest,
  SearchService,
  UpdateSearchDictionaryRequest,
  UpdateSearchExperienceRequest,
  UpdateSearchSourceRequest,
} from './search.service';

@Controller('metadata/search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('experiences')
  async listExperiences() {
    return this.searchService.listExperiences();
  }

  @Post('experiences')
  async createExperience(
    @Body() body: CreateSearchExperienceRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.createExperience(body, user?.id);
  }

  @Put('experiences/:code')
  async updateExperience(
    @Param('code') code: string,
    @Body() body: UpdateSearchExperienceRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.updateExperience(code, body, user?.id);
  }

  @Post('experiences/:code/publish')
  async publishExperience(@Param('code') code: string, @CurrentUser() user?: RequestUser) {
    return this.searchService.publishExperience(code, user?.id);
  }

  @Get('sources')
  async listSources() {
    return this.searchService.listSources();
  }

  @Post('sources')
  async createSource(
    @Body() body: CreateSearchSourceRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.createSource(body, user?.id);
  }

  @Put('sources/:code')
  async updateSource(
    @Param('code') code: string,
    @Body() body: UpdateSearchSourceRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.updateSource(code, body, user?.id);
  }

  @Get('dictionaries')
  async listDictionaries() {
    return this.searchService.listDictionaries();
  }

  @Post('dictionaries')
  async createDictionary(
    @Body() body: CreateSearchDictionaryRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.createDictionary(body, user?.id);
  }

  @Put('dictionaries/:code')
  async updateDictionary(
    @Param('code') code: string,
    @Body() body: UpdateSearchDictionaryRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.searchService.updateDictionary(code, body, user?.id);
  }

  @Get('index-state')
  async listIndexState(@Query('collection_code') collectionCode?: string) {
    return this.searchService.listIndexState(collectionCode);
  }
}
