import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  RAGService,
  RAGOptions,
  LLMService,
  LLMChatMessage,
} from '@hubblewave/ai';
import { DataSource } from 'typeorm';
import { JwtAuthGuard, CurrentUser } from '@hubblewave/auth-guard';

interface QueryDto {
  question: string;
  options?: RAGOptions;
}

interface ChatDto {
  messages: LLMChatMessage[];
  options?: RAGOptions;
}

interface CompletionDto {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

interface SummarizeDto {
  text: string;
  maxLength?: number;
  style?: 'brief' | 'detailed' | 'bullet';
}

@ApiTags('AI Chat')
@ApiBearerAuth()
@Controller('api/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private ragService: RAGService,
    private llmService: LLMService,
    private dataSource: DataSource
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check AI service status' })
  @ApiResponse({ status: 200, description: 'AI service status' })
  async getStatus() {
    const status = await this.llmService.getStatus();

    return {
      available: status.available,
      provider: status.provider,
      defaultModel: status.defaultModel,
      embeddingModel: status.embeddingModel,
      availableModels: status.availableModels.map((m) => ({
        name: m.name,
        contextLength: m.contextLength,
      })),
    };
  }

  @Post('query')
  @ApiOperation({ summary: 'Ask a question using RAG' })
  @ApiResponse({ status: 200, description: 'RAG response with sources' })
  async query(
    @CurrentUser() _user: any,
    @Body() dto: QueryDto
  ) {
    const response = await this.ragService.query(
      this.dataSource,
      dto.question,
      dto.options
    );

    return {
      answer: response.answer,
      sources: response.sources,
      model: response.modelUsed,
      duration: response.totalDuration,
    };
  }

  @Post('query/stream')
  @ApiOperation({ summary: 'Stream a RAG response' })
  async queryStream(
    @CurrentUser() _user: any,
    @Body() dto: QueryDto,
    @Res() res: Response
  ) {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const event of this.ragService.queryStream(
        this.dataSource,
        dto.question,
        dto.options
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: (error as Error).message })}\n\n`
      );
      res.end();
    }
  }

  @Post('conversation')
  @ApiOperation({ summary: 'Continue a conversation with RAG context' })
  @ApiResponse({ status: 200, description: 'Conversation response' })
  async chat(
    @CurrentUser() _user: any,
    @Body() dto: ChatDto
  ) {
    const response = await this.ragService.chat(
      this.dataSource,
      dto.messages,
      dto.options
    );

    return {
      answer: response.answer,
      sources: response.sources,
      model: response.modelUsed,
      duration: response.totalDuration,
    };
  }

  @Post('complete')
  @ApiOperation({ summary: 'Generate a completion without RAG' })
  @ApiResponse({ status: 200, description: 'Completion response' })
  async complete(@Body() dto: CompletionDto) {
    const response = await this.ragService.complete(
      dto.prompt,
      dto.systemPrompt,
      dto.temperature
    );

    return { response };
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize text content' })
  @ApiResponse({ status: 200, description: 'Summary' })
  async summarize(@Body() dto: SummarizeDto) {
    const summary = await this.ragService.summarize(
      dto.text,
      dto.maxLength,
      dto.style
    );

    return { summary };
  }

  @Post('suggestions')
  @ApiOperation({ summary: 'Get AI-powered suggestions' })
  @ApiResponse({ status: 200, description: 'Suggestions list' })
  async getSuggestions(
    @CurrentUser() _user: any,
    @Body()
    dto: {
      context: string;
      type: 'next_action' | 'related_content' | 'similar_issues';
      limit?: number;
    }
  ) {
    const suggestions = await this.ragService.generateSuggestions(
      this.dataSource,
      dto.context,
      dto.type,
      dto.limit
    );

    return { suggestions };
  }
}

