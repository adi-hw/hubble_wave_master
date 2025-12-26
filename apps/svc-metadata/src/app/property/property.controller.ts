import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
// Removed TenantId decorator
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { PropertyService, CreatePropertyDto, UpdatePropertyDto } from './property.service';
import { PropertyAvaService } from './property-ava.service';

@Controller('collections/:collectionId/properties')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
    private readonly avaService: PropertyAvaService
  ) {}

  @Get('suggest')
  async suggest(
    @Query('name') name: string,
  ) {
    if (!name) return {};
    return this.avaService.suggestFromName(name);
  }

  @Post('detect-type')
  async detectType(
    @Body() body: { samples: string[] },
  ) {
    return this.avaService.detectTypeFromSamples(body.samples);
  }

  @Get()
  async list(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('includeSystem') includeSystem?: string,
  ) {
    return this.propertyService.listProperties(collectionId, {
      includeSystem: includeSystem === 'true',
    });
  }

  @Get('by-code/:code')
  async getByCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    return this.propertyService.getPropertyByCode(collectionId, code);
  }

  @Get('check-code/:code')
  async checkCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    const available = await this.propertyService.isCodeAvailable(collectionId, code);
    return { code, available };
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.propertyService.getProperty(id);
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreatePropertyDto,
    @Req() request: Request,
  ) {
    return this.propertyService.createProperty(collectionId, dto, user?.id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    });
  }

  @Post('bulk')
  async bulkCreate(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() body: { properties: CreatePropertyDto[]; stopOnError?: boolean },
    @Req() request: Request,
  ) {
    return this.propertyService.bulkCreateProperties(
      collectionId,
      body.properties,
      user?.id,
      body.stopOnError,
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] as string | undefined },
    );
  }

  @Put('reorder')
  async reorder(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() body: { order: Array<{ id: string; displayOrder: number }> },
    @Req() request: Request,
  ) {
    return this.propertyService.reorderProperties(
      collectionId,
      body.order,
      user?.id,
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] as string | undefined },
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() request: Request,
  ) {
    return this.propertyService.updateProperty(id, dto, user?.id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    });
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
    @Req() request?: Request,
  ) {
    return this.propertyService.deleteProperty(
      id,
      force === 'true',
      user?.id,
      { ipAddress: request?.ip, userAgent: request?.headers['user-agent'] as string | undefined },
    );
  }
}
