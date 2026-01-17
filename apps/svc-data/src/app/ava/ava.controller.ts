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
} from '@nestjs/common';
import { AVACoreService } from './ava-core.service';
import { ConversationStatus, FeedbackType } from '@hubblewave/instance-db';

interface AuthenticatedRequest {
  user: {
    sub: string;
    username: string;
    roles: string[];
    permissions: string[];
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
export class AVAController {
  constructor(private readonly avaService: AVACoreService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatRequestDto, @Req() req: AuthenticatedRequest) {
    const userContext = {
      id: req.user.sub,
      name: req.user.username,
      email: `${req.user.username}@hubblewave.com`,
      role: req.user.roles[0] || 'user',
      permissions: req.user.permissions,
      organizationId: 'org-1',
      organizationName: 'HubbleWave',
    };

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
    return this.avaService.getConversations(req.user.sub, {
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
    return this.avaService.getConversation(id, req.user.sub);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.avaService.getMessages(id, {
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
    await this.avaService.endConversation(id, req.user.sub);
  }

  @Post('messages/:id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() dto: FeedbackRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.avaService.submitFeedback(id, req.user.sub, dto);
  }

  @Get('suggestions')
  async getSuggestions(
    @Req() req: AuthenticatedRequest,
    @Query('entity') entity?: string,
    @Query('property') property?: string,
  ) {
    return this.avaService.getSuggestions(req.user.sub, { entity, property });
  }

  @Post('suggestions/:id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respondToSuggestion(
    @Param('id') id: string,
    @Body() dto: SuggestionResponseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.avaService.respondToSuggestion(id, req.user.sub, dto);
  }

  @Get('stats')
  async getUsageStats(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    // Check if admin to get global stats
    const isAdmin = req.user.roles.includes('admin');
    const userId = isAdmin ? undefined : req.user.sub;

    return this.avaService.getUsageStats(userId, dateRange);
  }
}
