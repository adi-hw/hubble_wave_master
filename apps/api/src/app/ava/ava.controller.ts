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
import {
  AuthenticatedOnly,
  AuthenticatedRequest,
  CurrentUser,
  JwtAuthGuard,
  RequestUser,
  extractContext,
} from '@hubblewave/auth-guard';
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
/**
 * Canon §28 + §11 / W2 Stream 3 Task 25 — AVA conversational + AI
 * authoring assistant. User-facing feature surface; authenticated
 * identity is sufficient. Per-collection ACL applies at the data
 * layer for routes that read corpus/records.
 */
@AuthenticatedOnly()
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
      userRole: user.roleCodes?.[0],
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
      userRole: user.roleCodes?.[0],
      ...dto.context,
    };

    const userMessage: AVAMessage = {
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    };

    // Transaction 1 (F052): get-or-create the conversation and persist the
    // user message atomically. If either step fails, the conversation is
    // either pre-existing and untouched, or never created — there is no
    // intermediate state where the conversation exists with a dangling
    // first user turn that was supposed to roll back.
    const { conversationId, history } = await dataSource.transaction(
      async (manager): Promise<{ conversationId: string; history: AVAMessage[] }> => {
        let resolvedConversationId = dto.conversationId;
        let resolvedHistory: AVAMessage[] = [];

        if (resolvedConversationId) {
          resolvedHistory = await this.conversationMemory.getConversationHistory(
            manager,
            resolvedConversationId,
            organizationId,
            user.id,
          );
        } else {
          const conversation = await this.conversationMemory.startConversation(
            manager,
            user.id,
            organizationId,
            context,
          );
          resolvedConversationId = conversation.id;
        }

        await this.conversationMemory.addMessage(
          manager,
          resolvedConversationId,
          organizationId,
          user.id,
          userMessage,
        );

        return { conversationId: resolvedConversationId, history: resolvedHistory };
      },
    );

    // LLM call runs OUTSIDE the transaction: it is a network round-trip
    // (potentially many seconds), it cannot be rolled back, and holding a
    // Postgres transaction open across it would pin a connection from the
    // pool for the duration of the model response.
    const response = await this.avaService.chat(dataSource, dto.message, context, history);

    const assistantMessage: AVAMessage = {
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      sources: response.sources,
      actions: response.suggestedActions,
      cards: response.cards,
    };

    // Transaction 2 (F052): persist the assistant message. If this fails
    // (e.g. a DB blip after the LLM returned), the user message and
    // conversation from Transaction 1 stay committed — the conversation is
    // intact, just missing the assistant turn — and we log loudly with the
    // conversationId so operators can correlate the lost reply.
    try {
      await dataSource.transaction(async (manager) => {
        await this.conversationMemory.addMessage(
          manager,
          conversationId,
          organizationId,
          user.id,
          assistantMessage,
        );
      });
    } catch (err) {
      this.logger.error(
        `[F052] Assistant message persistence failed for conversationId=${conversationId}, userId=${user.id}, organizationId=${organizationId}: ${
          (err as Error).message
        }`,
        (err as Error).stack,
      );
      throw err;
    }

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
      userRole: user.roleCodes?.[0],
      ...dto.context,
    };

    // Transaction 1 (F052): get-or-create the conversation atomically. If
    // creation fails the SSE stream never starts and the exception
    // propagates to Nest's exception filter, which returns a proper HTTP
    // status — no SSE headers have been sent yet.
    const { conversationId, history } = await dataSource.transaction(
      async (manager): Promise<{ conversationId: string; history: AVAMessage[] }> => {
        let resolvedConversationId = dto.conversationId;
        let resolvedHistory: AVAMessage[] = [];

        if (resolvedConversationId) {
          resolvedHistory = await this.conversationMemory.getConversationHistory(
            manager,
            resolvedConversationId,
            organizationId,
            user.id,
          );
        } else {
          const conversation = await this.conversationMemory.startConversation(
            manager,
            user.id,
            organizationId,
            context,
          );
          resolvedConversationId = conversation.id;
        }

        return { conversationId: resolvedConversationId, history: resolvedHistory };
      },
    );

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'conversationId', data: conversationId })}\n\n`);

    try {
      let fullMessage = '';

      // LLM stream runs OUTSIDE any transaction (network IO, can't roll back).
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

      // Transaction 2 (F052): persist BOTH the user message and the
      // assistant reply in a single transaction so the conversation can
      // never end up with one message but not the other. If this fails
      // after the LLM has already streamed to the client, log loudly with
      // the conversationId so operators can correlate the lost turn.
      try {
        await dataSource.transaction(async (manager) => {
          await this.conversationMemory.addMessage(
            manager,
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
            manager,
            conversationId,
            organizationId,
            user.id,
            {
              role: 'assistant',
              content: fullMessage,
              timestamp: new Date(),
            },
          );
        });
      } catch (err) {
        this.logger.error(
          `[F052] Streaming chat turn persistence failed for conversationId=${conversationId}, userId=${user.id}, organizationId=${organizationId}: ${
            (err as Error).message
          }`,
          (err as Error).stack,
        );
        throw err;
      }

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
      userRole: user.roleCodes?.[0],
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
      userRole: user.roleCodes?.[0],
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
      userRole: user.roleCodes?.[0],
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
      userRole: user.roleCodes?.[0],
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
      userRole: user.roleCodes?.[0],
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

