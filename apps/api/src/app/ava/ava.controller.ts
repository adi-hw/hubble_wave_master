import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  AVAService,
  AVAContext,
  AVAMessage,
  LLMService,
  ConversationMemoryService,
  InsightsService,
  ActionExecutorService,
  AVA_BRANDING,
} from '@hubblewave/ai';
import { DataSource } from 'typeorm';
import { JwtAuthGuard, CurrentUser, RequestUser, extractContext, AuthenticatedRequest } from '@hubblewave/auth-guard';
import { AvaPreviewService } from './ava-preview.service';

/**
 * Resolve the caller's organization/instance context from the request. Order:
 *   1. JWT claim (organizationId / instanceSlug populated by identity service)
 *   2. `X-Instance-Slug` header (set by gateway / web client)
 * Fails closed when nothing is found — the conversation memory layer requires
 * an explicit organizationId on every call.
 */
function resolveOrganizationId(req: Request): string {
  const claim = (req as unknown as { user?: Record<string, unknown> }).user;
  const claimOrgId =
    (claim?.['organizationId'] as string | undefined) ||
    (claim?.['instanceSlug'] as string | undefined);

  const headerRaw = req.headers?.['x-instance-slug'];
  const headerSlug = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

  const organizationId = (claimOrgId || headerSlug || '').trim();
  if (!organizationId) {
    throw new UnauthorizedException('Instance context missing');
  }
  return organizationId;
}

/**
 * Map a server-side error to a client-safe SSE error payload. Known business
 * exceptions surface their message (the framework guarantees they are
 * sanitized); everything else is opaque with a correlation ID for operators.
 */
function buildSseErrorPayload(
  error: unknown,
  logger: Logger,
  context: string,
): { type: 'error'; data: string; correlationId?: string } {
  const correlationId = randomUUID();
  if (
    error instanceof ForbiddenException ||
    error instanceof NotFoundException ||
    error instanceof BadRequestException
  ) {
    logger.warn(`[${correlationId}] ${context}: ${(error as Error).message}`);
    return { type: 'error', data: (error as Error).message, correlationId };
  }
  logger.error(
    `[${correlationId}] ${context}: ${(error as Error)?.message || 'unknown'}`,
    (error as Error)?.stack,
  );
  return {
    type: 'error',
    data: 'Internal error processing chat',
    correlationId,
  };
}

interface ChatRequestDto {
  message: string;
  conversationId?: string;
  context?: Partial<AVAContext>;
}

interface ActionRequestDto {
  action: {
    type: 'navigate' | 'create' | 'update' | 'execute';
    label: string;
    target: string;
    params?: Record<string, unknown>;
  };
  previewId?: string;
  approved?: boolean;
  confirmationRequired?: boolean;
  reason?: string;
}

interface PreviewRequestDto {
  action: {
    type: 'create' | 'update' | 'execute';
    label: string;
    target: string;
    params?: Record<string, unknown>;
  };
  userMessage?: string;
  avaResponse?: string;
  conversationId?: string;
}

@ApiTags('AVA - AI Virtual Assistant')
@ApiBearerAuth()
@Controller('ava')
@UseGuards(JwtAuthGuard)
export class AVAController {
  private readonly logger = new Logger(AVAController.name);

  constructor(
    private avaService: AVAService,
    private llmService: LLMService,
    private conversationMemory: ConversationMemoryService,
    private insightsService: InsightsService,
    private actionExecutor: ActionExecutorService,
    private previewService: AvaPreviewService,
    private dataSource: DataSource
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get AVA status and branding' })
  @ApiResponse({ status: 200, description: 'AVA status and branding info' })
  async getStatus() {
    const llmStatus = await this.llmService.getStatus();

    return {
      name: AVA_BRANDING.name,
      fullName: AVA_BRANDING.fullName,
      tagline: AVA_BRANDING.tagline,
      avatar: AVA_BRANDING.avatar,
      colors: AVA_BRANDING.colors,
      available: llmStatus.available,
      provider: llmStatus.provider,
      model: llmStatus.defaultModel,
    };
  }

  @Get('greeting')
  @ApiOperation({ summary: 'Get a greeting from AVA' })
  @ApiResponse({ status: 200, description: 'AVA greeting' })
  async getGreeting(
    @CurrentUser() user: RequestUser
  ) {
    const context: AVAContext = {
      userId: user.id,
      userName: user.username,
      userRole: user.roles?.[0],
    };

    return {
      greeting: this.avaService.getGreeting(context),
      branding: AVA_BRANDING,
    };
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AVA' })
  @ApiResponse({ status: 200, description: 'AVA response' })
  async chat(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
  ) {
    const dataSource = this.dataSource;
    const organizationId = resolveOrganizationId(req);

    const context: AVAContext = {
      userId: user.id,
      userName: user.username,
      userRole: user.roles?.[0],
      ...dto.context,
    };

    // Get or create conversation
    let conversationId = dto.conversationId;
    let history: AVAMessage[] = [];

    if (conversationId) {
      history = await this.conversationMemory.getConversationHistory(
        dataSource,
        conversationId,
        organizationId,
        user.id,
      );
    } else {
      const conversation = await this.conversationMemory.startConversation(
        dataSource,
        user.id,
        organizationId,
        context,
      );
      conversationId = conversation.id;
    }

    // Add user message to history
    const userMessage: AVAMessage = {
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    };
    await this.conversationMemory.addMessage(
      dataSource,
      conversationId,
      organizationId,
      user.id,
      userMessage,
    );

    // Get AVA response
    const response = await this.avaService.chat(dataSource, dto.message, context, history);

    // Add assistant message to history
    const assistantMessage: AVAMessage = {
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      sources: response.sources,
      actions: response.suggestedActions,
      cards: response.cards,
    };
    await this.conversationMemory.addMessage(
      dataSource,
      conversationId,
      organizationId,
      user.id,
      assistantMessage,
    );

    return {
      conversationId,
      message: response.message,
      sources: response.sources,
      suggestedActions: response.suggestedActions,
      followUpQuestions: response.followUpQuestions,
      cards: response.cards,
      confidence: response.confidence,
      model: response.model,
      duration: response.duration,
    };
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Stream chat response from AVA' })
  async chatStream(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const dataSource = this.dataSource;
    const organizationId = resolveOrganizationId(req);

    const context: AVAContext = {
      userId: user.id,
      userName: user.username,
      userRole: user.roles?.[0],
      ...dto.context,
    };

    // Get or create conversation
    let conversationId = dto.conversationId;
    let history: AVAMessage[] = [];

    if (conversationId) {
      history = await this.conversationMemory.getConversationHistory(
        dataSource,
        conversationId,
        organizationId,
        user.id,
      );
    } else {
      const conversation = await this.conversationMemory.startConversation(
        dataSource,
        user.id,
        organizationId,
        context,
      );
      conversationId = conversation.id;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'conversationId', data: conversationId })}\n\n`);

    try {
      let fullMessage = '';

      for await (const event of this.avaService.chatStream(
        dataSource,
        dto.message,
        context,
        history
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (event.type === 'chunk') {
          fullMessage += event.data;
        }
      }

      // Save messages to conversation history
      await this.conversationMemory.addMessage(
        dataSource,
        conversationId,
        organizationId,
        user.id,
        {
          role: 'user',
          content: dto.message,
          timestamp: new Date(),
        },
      );

      await this.conversationMemory.addMessage(
        dataSource,
        conversationId,
        organizationId,
        user.id,
        {
          role: 'assistant',
          content: fullMessage,
          timestamp: new Date(),
        },
      );

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const payload = buildSseErrorPayload(error, this.logger, 'AVA chatStream');
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get user conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const dataSource = this.dataSource;
    const organizationId = resolveOrganizationId(req);

    const conversations = await this.conversationMemory.getUserConversations(
      dataSource,
      user.id,
      organizationId,
      limit ? parseInt(limit, 10) : 20,
    );

    return { conversations };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  async getConversation(
    @CurrentUser() user: RequestUser,
    @Param('id') conversationId: string,
    @Req() req: Request,
  ) {
    const dataSource = this.dataSource;
    const organizationId = resolveOrganizationId(req);

    const conversation = await this.conversationMemory.getConversation(
      dataSource,
      conversationId,
      organizationId,
      user.id,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return { conversation };
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @CurrentUser() user: RequestUser,
    @Param('id') conversationId: string,
    @Req() req: Request,
  ) {
    const dataSource = this.dataSource;
    const organizationId = resolveOrganizationId(req);

    const conversation = await this.conversationMemory.getConversation(
      dataSource,
      conversationId,
      organizationId,
      user.id,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.conversationMemory.deleteConversation(
      dataSource,
      conversationId,
      organizationId,
      user.id,
    );

    return { success: true };
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get proactive insights from AVA' })
  @ApiResponse({ status: 200, description: 'List of insights' })
  async getInsights(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string
  ) {
    const dataSource = this.dataSource;

    const context = {
      userId: user.id,
      userRole: user.roles?.[0],
    };

    const insights = await this.insightsService.generateInsights(
      dataSource,
      context,
      limit ? parseInt(limit, 10) : 5
    );

    return { insights };
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized recommendations' })
  @ApiResponse({ status: 200, description: 'Personalized recommendations' })
  async getRecommendations(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string
  ) {
    const dataSource = this.dataSource;

    const context = {
      userId: user.id,
      userRole: user.roles?.[0],
    };

    const recommendations = await this.insightsService.getPersonalizedRecommendations(
      dataSource,
      context,
      limit ? parseInt(limit, 10) : 3
    );

    return { recommendations };
  }

  @Get('quick-actions')
  @ApiOperation({ summary: 'Get quick actions based on context' })
  @ApiResponse({ status: 200, description: 'Quick actions' })
  async getQuickActions(
    @CurrentUser() user: RequestUser,
    @Query('currentPage') currentPage?: string
  ) {
    const context: AVAContext = {
      userId: user.id,
      userRole: user.roles?.[0],
      currentPage,
    };

    const actions = await this.avaService.getQuickActions(context);

    return { actions };
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an action through AVA' })
  @ApiResponse({ status: 200, description: 'Action result' })
  async executeAction(
    @CurrentUser() user: RequestUser,
    @Body() dto: ActionRequestDto,
    @Req() req: AuthenticatedRequest
  ) {
    const dataSource = this.dataSource;

    const context: AVAContext = {
      userId: user.id,
      userRole: user.roles?.[0],
    };

    if (!dto.previewId) {
      return {
        success: false,
        message: 'Preview is required before execution.',
        error: 'PREVIEW_REQUIRED',
      };
    }

    // Do NOT forward dto.approved or dto.confirmationRequired — those are
    // client-trusted flags and would let an attacker bypass the preview
    // gate by setting them in the request body. The executor derives
    // approval strictly from the preview row's ownership + status + the
    // action+params hash matching what was previewed.
    const result = await this.actionExecutor.execute(dataSource, {
      action: dto.action,
      context,
      previewId: dto.previewId,
      reason: dto.reason,
      requestContext: extractContext(req),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: user.sessionId,
    });

    return result;
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview an action through AVA' })
  @ApiResponse({ status: 200, description: 'Preview result' })
  async previewAction(
    @CurrentUser() user: RequestUser,
    @Body() dto: PreviewRequestDto,
    @Req() req: AuthenticatedRequest
  ) {
    const context: AVAContext = {
      userId: user.id,
      userRole: user.roles?.[0],
    };

    return this.previewService.preview({
      action: dto.action,
      context,
      requestContext: extractContext(req),
      userMessage: dto.userMessage,
      avaResponse: dto.avaResponse,
      conversationId: dto.conversationId,
    });
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize text using AVA' })
  @ApiResponse({ status: 200, description: 'Text summary' })
  async summarize(
    @Body() dto: { text: string; style?: 'brief' | 'detailed' | 'bullet' }
  ) {
    const summary = await this.avaService.summarize(dto.text, dto.style || 'brief');
    return { summary };
  }

  @Post('transform')
  @ApiOperation({ summary: 'Transform text using AVA' })
  @ApiResponse({ status: 200, description: 'Transformed text' })
  async transform(
    @Body() dto: { text: string; instruction: string; context?: any }
  ) {
    const text = await this.avaService.transformText(dto.text, dto.instruction, dto.context);
    return { text };
  }

  @Get('branding')
  @ApiOperation({ summary: 'Get AVA branding assets' })
  @ApiResponse({ status: 200, description: 'AVA branding' })
  getBranding() {
    return AVA_BRANDING;
  }
}

