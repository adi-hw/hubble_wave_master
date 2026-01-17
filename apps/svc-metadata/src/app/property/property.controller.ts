import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, CurrentUser, RequestUser, RequirePermission } from '@hubblewave/auth-guard';
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
  @RequirePermission('property.read')
  async suggest(
    @Query('name') name: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    if (!name) return {};
    return this.avaService.suggestFromName(name);
  }

  @Post('detect-type')
  @RequirePermission('property.read')
  async detectType(
    @Body() body: { samples: string[] },
    @CurrentUser() user: RequestUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    return this.avaService.detectTypeFromSamples(body.samples);
  }

  @Get()
  @RequirePermission('property.read')
  async list(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('includeSystem') includeSystem?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('propertyTypeId') propertyTypeId?: string,
  ) {
    return this.propertyService.listProperties(collectionId, {
      includeSystem: includeSystem === 'true',
      includeInactive: includeInactive === 'true',
      propertyTypeId,
    });
  }

  @Get('by-code/:code')
  @RequirePermission('property.read')
  async getByCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    return this.propertyService.getPropertyByCode(collectionId, code);
  }

  @Get('check-code/:code')
  @RequirePermission('property.read')
  async checkCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    const available = await this.propertyService.isCodeAvailable(collectionId, code);
    return { code, available };
  }

  @Get(':id')
  @RequirePermission('property.read')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.propertyService.getProperty(id);
  }

  @Post()
  @RequirePermission('property.create')
  async create(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreatePropertyDto,
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.createProperty(collectionId, dto, user.id, context);
  }

  @Post('bulk')
  @RequirePermission('property.create')
  async bulkCreate(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() body: { properties: CreatePropertyDto[]; stopOnError?: boolean },
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.bulkCreateProperties(
      collectionId,
      body.properties,
      user.id,
      body.stopOnError,
      context,
    );
  }

  @Put('reorder')
  @RequirePermission('property.update')
  async reorder(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() body: { order: Array<{ id: string; position: number }> },
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    return this.propertyService.reorderProperties(
      collectionId,
      body.order,
      user.id,
    );
  }

  @Put(':id')
  @RequirePermission('property.update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.updateProperty(id, dto, user.id, context);
  }

  @Delete(':id')
  @RequirePermission('property.delete')
  async delete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Query('force') force?: string,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.deleteProperty(id, force === 'true', user.id, context);
  }
}
