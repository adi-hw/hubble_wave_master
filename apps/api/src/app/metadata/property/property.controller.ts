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
  NotFoundException,
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
  @RequirePermission('metadata:property:read')
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
  @RequirePermission('metadata:property:read')
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
  @RequirePermission('metadata:property:read')
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
  @RequirePermission('metadata:property:read')
  async getByCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    return this.propertyService.getPropertyByCode(collectionId, code);
  }

  @Get('check-code/:code')
  @RequirePermission('metadata:property:read')
  async checkCode(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('code') code: string,
  ) {
    const available = await this.propertyService.isCodeAvailable(collectionId, code);
    return { code, available };
  }

  @Get(':id')
  @RequirePermission('metadata:property:read')
  async getById(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const property = await this.propertyService.getProperty(id);
    // IDOR protection: verify the property actually belongs to the collection
    // declared in the route. Use NotFound (not Forbidden) to avoid leaking existence.
    if (!property || property.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    return property;
  }

  /**
   * "Where used" report — returns every dependent (formula, view, automation,
   * form, validation rule, display rule) that references this property. Backs
   * the admin UI's pre-delete inspection view.
   */
  @Get(':id/references')
  @RequirePermission('metadata:property:read')
  async references(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.propertyService.findReferences(id);
  }

  @Post()
  @RequirePermission('metadata:property:manage')
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
  @RequirePermission('metadata:property:manage')
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
  @RequirePermission('metadata:property:manage')
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
  @RequirePermission('metadata:property:manage')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    // IDOR protection: confirm the property belongs to the collection in the
    // route before mutating. Without this an attacker who guesses an id from
    // another collection can update fields they shouldn't see.
    const existing = await this.propertyService.getProperty(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.updateProperty(id, dto, user.id, context);
  }

  @Delete(':id')
  @RequirePermission('metadata:property:manage')
  async delete(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Query('force') force?: string,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    // IDOR protection: same as update — block cross-collection mutation.
    const existing = await this.propertyService.getProperty(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.deleteProperty(id, force === 'true', user.id, context);
  }

  @Post(':id/publish')
  @RequirePermission('metadata:property:manage')
  async publish(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const existing = await this.propertyService.getProperty(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.publishProperty(id, user.id, context);
  }

  @Post(':id/deprecate')
  @RequirePermission('metadata:property:manage')
  async deprecate(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    const existing = await this.propertyService.getProperty(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    const context = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    };
    return this.propertyService.deprecateProperty(id, user.id, context);
  }

  @Get(':id/revisions')
  @RequirePermission('metadata:property:read')
  async listRevisions(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const property = await this.propertyService.getProperty(id);
    if (!property || property.collectionId !== collectionId) {
      throw new NotFoundException('Property not found');
    }
    return this.propertyService.listRevisions(id);
  }
}
