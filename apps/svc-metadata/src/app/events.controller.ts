import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import {
  TenantDbService,
  EventDefinition,
  EventLog,
  EventSubscription,
} from '@eam-platform/tenant-db';
import type {
  EventCategory,
  EventSourceType,
  EventHandlerType,
  EventExecutionMode,
} from '@eam-platform/tenant-db';

interface CreateEventDefinitionDto {
  code: string;
  name: string;
  description?: string;
  category?: EventCategory;
  sourceType: EventSourceType;
  sourceConfig?: Record<string, any>;
  payloadSchema?: Record<string, any>;
  retentionDays?: number;
  isActive?: boolean;
}

interface CreateSubscriptionDto {
  name: string;
  description?: string;
  eventCodes: string[];
  sourceFilter?: Record<string, any>;
  handlerType: EventHandlerType;
  handlerConfig: Record<string, any>;
  executionMode?: EventExecutionMode;
  batchConfig?: Record<string, any>;
  retryConfig?: Record<string, any>;
  conditionExpression?: Record<string, any>;
  isActive?: boolean;
}

@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class EventsController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Event Definitions ==========

  @Get()
  async listEventDefinitions(
    @Query('category') category: string,
    @Query('sourceType') sourceType: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventDefinition>(ctx.tenantId, EventDefinition);

    const where: any = {};
    if (category) where.category = category;
    if (sourceType) where.sourceType = sourceType;
    if (active !== undefined) where.isActive = active === 'true';

    const events = await repo.find({
      where,
      order: { category: 'ASC', code: 'ASC' },
    });

    return { items: events };
  }

  @Get(':id')
  async getEventDefinition(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventDefinition>(ctx.tenantId, EventDefinition);
    const event = await repo.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException('Event definition not found');
    }

    return event;
  }

  @Post()
  async createEventDefinition(@Body() body: CreateEventDefinitionDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventDefinition>(ctx.tenantId, EventDefinition);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Event with code "${body.code}" already exists`);
    }

    const event = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      description: body.description,
      category: body.category,
      sourceType: body.sourceType,
      sourceConfig: body.sourceConfig,
      payloadSchema: body.payloadSchema,
      isPublished: true,
      retentionDays: body.retentionDays || 30,
      isSystem: false,
      isActive: body.isActive !== false,
    });

    return repo.save(event);
  }

  @Patch(':id')
  async updateEventDefinition(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDefinitionDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventDefinition>(ctx.tenantId, EventDefinition);
    const event = await repo.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException('Event definition not found');
    }

    if (event.isSystem) {
      throw new ForbiddenException('Cannot modify system events');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== event.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Event with code "${body.code}" already exists`);
      }
    }

    // Build update object with proper typing
    const updateData: Partial<EventDefinition> = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.sourceType !== undefined) updateData.sourceType = body.sourceType;
    if (body.sourceConfig !== undefined) updateData.sourceConfig = body.sourceConfig;
    if (body.payloadSchema !== undefined) updateData.payloadSchema = body.payloadSchema;
    if (body.retentionDays !== undefined) updateData.retentionDays = body.retentionDays;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = repo.merge(event, updateData);
    return repo.save(updated);
  }

  @Delete(':id')
  async deleteEventDefinition(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventDefinition>(ctx.tenantId, EventDefinition);
    const event = await repo.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException('Event definition not found');
    }

    if (event.isSystem) {
      throw new ForbiddenException('Cannot delete system events');
    }

    await repo.remove(event);
    return { success: true };
  }

  // ========== Event Subscriptions ==========

  @Get('subscriptions')
  async listAllSubscriptions(
    @Query('handlerType') handlerType: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventSubscription>(
      ctx.tenantId,
      EventSubscription,
    );

    const where: any = { tenantId: ctx.tenantId };
    if (handlerType) where.handlerType = handlerType;
    if (active !== undefined) where.isActive = active === 'true';

    const subs = await repo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return { items: subs };
  }

  @Get(':eventCode/subscriptions')
  async listSubscriptionsForEvent(@Param('eventCode') eventCode: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventSubscription>(
      ctx.tenantId,
      EventSubscription,
    );

    // Find subscriptions that include this event code in their eventCodes array
    const allSubs = await repo.find({
      where: { tenantId: ctx.tenantId, isActive: true },
    });

    const matchingSubs = allSubs.filter(
      (sub) => sub.eventCodes && sub.eventCodes.includes(eventCode),
    );

    return { items: matchingSubs };
  }

  @Post('subscriptions')
  async createSubscription(@Body() body: CreateSubscriptionDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventSubscription>(
      ctx.tenantId,
      EventSubscription,
    );

    const subscription = repo.create({
      tenantId: ctx.tenantId,
      name: body.name,
      description: body.description,
      eventCodes: body.eventCodes,
      sourceFilter: body.sourceFilter,
      handlerType: body.handlerType,
      handlerConfig: body.handlerConfig,
      executionMode: body.executionMode || 'async',
      batchConfig: body.batchConfig,
      retryConfig: body.retryConfig || { maxRetries: 3, retryDelayMs: 1000 },
      conditionExpression: body.conditionExpression,
      isActive: body.isActive !== false,
      createdBy: ctx.userId,
    });

    return repo.save(subscription);
  }

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() body: Partial<CreateSubscriptionDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventSubscription>(
      ctx.tenantId,
      EventSubscription,
    );
    const subscription = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Build update object with proper typing
    const updateData: Partial<EventSubscription> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.eventCodes !== undefined) updateData.eventCodes = body.eventCodes;
    if (body.sourceFilter !== undefined) updateData.sourceFilter = body.sourceFilter;
    if (body.handlerType !== undefined) updateData.handlerType = body.handlerType;
    if (body.handlerConfig !== undefined) updateData.handlerConfig = body.handlerConfig;
    if (body.executionMode !== undefined) updateData.executionMode = body.executionMode;
    if (body.batchConfig !== undefined) updateData.batchConfig = body.batchConfig;
    if (body.retryConfig !== undefined) updateData.retryConfig = body.retryConfig;
    if (body.conditionExpression !== undefined) updateData.conditionExpression = body.conditionExpression;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = repo.merge(subscription, updateData);
    return repo.save(updated);
  }

  @Delete('subscriptions/:id')
  async deleteSubscription(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventSubscription>(
      ctx.tenantId,
      EventSubscription,
    );
    const subscription = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await repo.remove(subscription);
    return { success: true };
  }

  // ========== Event Logs ==========

  @Get('logs')
  async listEventLogs(
    @Query('eventCode') eventCode: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventLog>(ctx.tenantId, EventLog);

    const where: any = { tenantId: ctx.tenantId };
    if (eventCode) where.eventCode = eventCode;

    const logs = await repo.find({
      where,
      order: { occurredAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
      skip: parseInt(offset, 10) || 0,
    });

    return { items: logs };
  }

  @Get('logs/:id')
  async getEventLog(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<EventLog>(ctx.tenantId, EventLog);
    const log = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!log) {
      throw new NotFoundException('Event log not found');
    }

    return log;
  }

  @Post(':id/fire')
  async fireTestEvent(
    @Param('id') id: string,
    @Body() body: { payload: Record<string, any> },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const eventRepo = await this.tenantDb.getRepository<EventDefinition>(
      ctx.tenantId,
      EventDefinition,
    );
    const event = await eventRepo.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException('Event definition not found');
    }

    // Create event log entry
    const logRepo = await this.tenantDb.getRepository<EventLog>(ctx.tenantId, EventLog);
    const log = logRepo.create({
      tenantId: ctx.tenantId,
      eventDefinitionId: event.id,
      eventCode: event.code,
      sourceType: event.sourceType,
      sourceUserId: ctx.userId,
      payload: body.payload,
    });

    const saved = await logRepo.save(log);

    // In a real implementation, this would queue the event for processing
    // For now, we just mark it as processed
    saved.processedAt = new Date();
    await logRepo.save(saved);

    return {
      eventId: event.id,
      eventCode: event.code,
      logId: saved.id,
      status: 'processed',
      message: 'Test event fired successfully',
    };
  }
}
