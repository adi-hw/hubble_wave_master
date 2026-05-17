/**
 * AVA Controller
 * HubbleWave Platform - Phase 6
 *
 * REST API endpoints for AVA interactions.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { AVACoreService } from './ava-core.service';
import { ConversationStatus, FeedbackType } from '@hubblewave/instance-db';

interface AuthenticatedRequest {
  user: {
    sub: string;
    username: string;
    roleCodes: string[];
    permissionCodes: string[];
    instanceSlug?: string;
    organizationId?: string;
    organizationName?: string;
  };
  headers: {
    'x-instance-slug'?: string | string[];
    [key: string]: unknown;
  };
}

/**
 * Resolve the caller's instance/organization context from the request.
 * Order of resolution:
 *   1. JWT claim (organizationId / instanceSlug) populated by the identity service
 *   2. `X-Instance-Slug` request header (set by the gateway / web client)
 * Fails closed: if no instance context is available, the request is rejected.
 */
function resolveInstanceContext(req: AuthenticatedRequest): {
  organizationId: string;
  organizationName: string;
} {
  const claim = req.user as Record<string, unknown> | undefined;
  const claimOrgId = (claim?.organizationId as string | undefined) ?? (claim?.instanceSlug as string | undefined);
  const claimOrgName = claim?.organizationName as string | undefined;

  const headerRaw = req.headers?.['x-instance-slug'];
  const headerSlug = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

  const organizationId = claimOrgId || headerSlug;
  if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new UnauthorizedException('Instance context missing');
  }

  return {
    organizationId: organizationId.trim(),
    organizationName: claimOrgName || organizationId.trim(),
  };
}

interface ChatRequestDto {
  message: string;
  conversationId?: string;
}

interface FeedbackRequestDto {
  type: FeedbackType;
  rating?: number;
  comment?: string;
}

interface SuggestionResponseDto {
  accepted: boolean;
  feedback?: string;
}

@Controller('ava')
@UseGuards(JwtAuthGuard)
export class AVAController {
  constructor(private readonly avaService: AVACoreService) {}

  private buildUserContext(req: AuthenticatedRequest) {
    const instance = resolveInstanceContext(req);
    return {
      id: req.user.sub,
      name: req.user.username,
      email: `${req.user.username}@hubblewave.com`,
      role: req.user.roleCodes[0] || 'user',
      permissions: req.user.permissionCodes,
      organizationId: instance.organizationId,
      organizationName: instance.organizationName,
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatRequestDto, @Req() req: AuthenticatedRequest) {
    const userContext = this.buildUserContext(req);

    return this.avaService.chat(
      {
        message: dto.message,
        conversationId: dto.conversationId,
      },
      userContext,
    );
  }

  @Get('conversations')
  async getConversations(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: ConversationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const instance = resolveInstanceContext(req);
    return this.avaService.getConversations(req.user.sub, instance.organizationId, {
      status,
      limit: limit ? parseInt(String(limit)) : undefined,
      offset: offset ? parseInt(String(offset)) : undefined,
    });
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instance = resolveInstanceContext(req);
    return this.avaService.getConversation(id, req.user.sub, instance.organizationId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const instance = resolveInstanceContext(req);
    return this.avaService.getMessagesForConversation(id, req.user.sub, instance.organizationId, {
      limit: limit ? parseInt(String(limit)) : undefined,
      offset: offset ? parseInt(String(offset)) : undefined,
    });
  }

  @Post('conversations/:id/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  async endConversation(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instance = resolveInstanceContext(req);
    await this.avaService.endConversation(id, req.user.sub, instance.organizationId);
  }

  @Post('messages/:id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() dto: FeedbackRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    resolveInstanceContext(req);
    return this.avaService.submitFeedback(id, req.user.sub, dto);
  }

  @Get('suggestions')
  async getSuggestions(
    @Req() req: AuthenticatedRequest,
    @Query('entity') entity?: string,
    @Query('property') property?: string,
  ) {
    resolveInstanceContext(req);
    return this.avaService.getSuggestions(req.user.sub, { entity, property });
  }

  @Post('suggestions/:id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respondToSuggestion(
    @Param('id') id: string,
    @Body() dto: SuggestionResponseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    resolveInstanceContext(req);
    await this.avaService.respondToSuggestion(id, req.user.sub, dto);
  }

  @Get('stats')
  async getUsageStats(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    resolveInstanceContext(req);
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    // Check if admin to get global stats
    const isAdmin = req.user.roleCodes.includes('admin');
    const userId = isAdmin ? undefined : req.user.sub;

    return this.avaService.getUsageStats(userId, dateRange);
  }
}
