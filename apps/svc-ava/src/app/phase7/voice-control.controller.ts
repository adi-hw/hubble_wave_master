import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VoiceControlService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface VoiceCommandDto {
  audioData?: string;
  text?: string;
  context?: Record<string, unknown>;
}

interface RegisterPatternDto {
  pattern: string;
  intent: string;
  examples: string[];
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
}

@ApiTags('Phase 7 - Voice Control')
@ApiBearerAuth()
@Controller('api/phase7/voice')
@UseGuards(JwtAuthGuard)
export class VoiceControlController {
  constructor(
    private readonly voiceService: VoiceControlService,
  ) {}

  @Post('command')
  @ApiOperation({ summary: 'Process a voice command' })
  @ApiResponse({ status: 200, description: 'Command processed' })
  async processCommand(
    @CurrentUser() user: RequestUser,
    @Body() dto: VoiceCommandDto,
  ) {
    if (dto.text) {
      const result = await this.voiceService.processTextCommand(
        user.id,
        dto.text,
        dto.context,
      );
      return { result };
    }

    if (dto.audioData) {
      const audioBuffer = Buffer.from(dto.audioData, 'base64');
      const result = await this.voiceService.processVoiceCommand(
        user.id,
        audioBuffer,
        dto.context,
      );
      return { result };
    }

    return { error: 'Either audioData or text is required' };
  }

  @Get('commands')
  @ApiOperation({ summary: 'Get supported voice commands' })
  @ApiResponse({ status: 200, description: 'List of commands' })
  async getSupportedCommands(
    @CurrentUser() _user: RequestUser,
  ) {
    const commands = await this.voiceService.getSupportedCommands();
    return { commands };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get voice command history' })
  @ApiResponse({ status: 200, description: 'Command history' })
  async getHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const history = await this.voiceService.getCommandHistory(
      user.id,
      limit ? parseInt(limit, 10) : 50,
    );

    return { history };
  }

  @Post('patterns')
  @ApiOperation({ summary: 'Register a command pattern' })
  @ApiResponse({ status: 201, description: 'Pattern registered' })
  async registerPattern(
    @CurrentUser() _user: RequestUser,
    @Body() dto: RegisterPatternDto,
  ) {
    const pattern = await this.voiceService.registerPattern(dto);
    return { pattern };
  }

  @Get('patterns')
  @ApiOperation({ summary: 'Get registered patterns' })
  @ApiResponse({ status: 200, description: 'List of patterns' })
  async getPatterns(
    @CurrentUser() _user: RequestUser,
  ) {
    const patterns = await this.voiceService.getPatterns();
    return { patterns };
  }
}
