import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
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
} from '@eam-platform/ai';
import { TenantDbService } from '@eam-platform/tenant-db';
import { JwtAuthGuard, CurrentUser } from '@eam-platform/auth-guard';

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
  confirmationRequired?: boolean;
  reason?: string;
}

@ApiTags('AVA - AI Virtual Assistant')
@ApiBearerAuth()
@Controller('api/ava')
@UseGuards(JwtAuthGuard)
export class AVAController {
  constructor(
    private avaService: AVAService,
    private llmService: LLMService,
    private conversationMemory: ConversationMemoryService,
    private insightsService: InsightsService,
    private actionExecutor: ActionExecutorService,
    private tenantDbService: TenantDbService
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
    @CurrentUser() user: { tenantId: string; userId: string; name?: string; role?: string }
  ) {
    const context: AVAContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      userName: user.name,
      userRole: user.role,
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
    @CurrentUser() user: { tenantId: string; userId: string; name?: string; role?: string },
    @Body() dto: ChatRequestDto
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const context: AVAContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      userName: user.name,
      userRole: user.role,
      ...dto.context,
    };

    // Get or create conversation
    let conversationId = dto.conversationId;
    let history: AVAMessage[] = [];

    if (conversationId) {
      history = await this.conversationMemory.getConversationHistory(
        dataSource,
        conversationId
      );
    } else {
      const conversation = await this.conversationMemory.startConversation(
        dataSource,
        user.userId,
        user.tenantId,
        context
      );
      conversationId = conversation.id;
    }

    // Add user message to history
    const userMessage: AVAMessage = {
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    };
    await this.conversationMemory.addMessage(dataSource, conversationId, userMessage);

    // Get AVA response
    const response = await this.avaService.chat(dataSource, dto.message, context, history);

    // Add assistant message to history
    const assistantMessage: AVAMessage = {
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      sources: response.sources,
      actions: response.suggestedActions,
    };
    await this.conversationMemory.addMessage(dataSource, conversationId, assistantMessage);

    return {
      conversationId,
      message: response.message,
      sources: response.sources,
      suggestedActions: response.suggestedActions,
      followUpQuestions: response.followUpQuestions,
      confidence: response.confidence,
      model: response.model,
      duration: response.duration,
    };
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Stream chat response from AVA' })
  async chatStream(
    @CurrentUser() user: { tenantId: string; userId: string; name?: string; role?: string },
    @Body() dto: ChatRequestDto,
    @Res() res: Response
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const context: AVAContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      userName: user.name,
      userRole: user.role,
      ...dto.context,
    };

    // Get or create conversation
    let conversationId = dto.conversationId;
    let history: AVAMessage[] = [];

    if (conversationId) {
      history = await this.conversationMemory.getConversationHistory(
        dataSource,
        conversationId
      );
    } else {
      const conversation = await this.conversationMemory.startConversation(
        dataSource,
        user.userId,
        user.tenantId,
        context
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
      await this.conversationMemory.addMessage(dataSource, conversationId, {
        role: 'user',
        content: dto.message,
        timestamp: new Date(),
      });

      await this.conversationMemory.addMessage(dataSource, conversationId, {
        role: 'assistant',
        content: fullMessage,
        timestamp: new Date(),
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: (error as Error).message })}\n\n`
      );
      res.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get user conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Query('limit') limit?: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const conversations = await this.conversationMemory.getUserConversations(
      dataSource,
      user.userId,
      limit ? parseInt(limit, 10) : 20
    );

    return { conversations };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  async getConversation(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Param('id') conversationId: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const conversation = await this.conversationMemory.getConversation(
      dataSource,
      conversationId
    );

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    return { conversation };
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Param('id') conversationId: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    await this.conversationMemory.deleteConversation(dataSource, conversationId);

    return { success: true };
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get proactive insights from AVA' })
  @ApiResponse({ status: 200, description: 'List of insights' })
  async getInsights(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query('limit') limit?: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const context = {
      userId: user.userId,
      tenantId: user.tenantId,
      userRole: user.role,
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
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query('limit') limit?: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const context = {
      userId: user.userId,
      tenantId: user.tenantId,
      userRole: user.role,
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
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query('currentPage') currentPage?: string
  ) {
    const context: AVAContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      userRole: user.role,
      currentPage,
    };

    const actions = await this.avaService.getQuickActions(context);

    return { actions };
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an action through AVA' })
  @ApiResponse({ status: 200, description: 'Action result' })
  async executeAction(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Body() dto: ActionRequestDto
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const context: AVAContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      userRole: user.role,
    };

    const result = await this.actionExecutor.execute(dataSource, {
      action: dto.action,
      context,
      confirmationRequired: dto.confirmationRequired ?? false,
      reason: dto.reason,
    });

    return result;
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

  @Get('branding')
  @ApiOperation({ summary: 'Get AVA branding assets' })
  @ApiResponse({ status: 200, description: 'AVA branding' })
  getBranding() {
    return AVA_BRANDING;
  }
}
