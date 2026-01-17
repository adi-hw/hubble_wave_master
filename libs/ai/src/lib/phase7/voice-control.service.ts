// ============================================================
// Phase 7: Voice Control Service
// Hands-free platform operation via voice commands
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VoiceCommand,
  VoiceCommandPattern,
  VoiceIntent,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';
import { ActionExecutorService } from '../action-executor.service';

interface VoiceCommandResult {
  commandId: string;
  transcript: string;
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  action: string;
  result: unknown;
  executionTime: number;
}

interface CommandPattern {
  pattern: string;
  intent: string;
  examples: string[];
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
}

@Injectable()
export class VoiceControlService {
  private readonly logger = new Logger(VoiceControlService.name);

  constructor(
    @InjectRepository(VoiceCommand)
    private readonly voiceCommandRepo: Repository<VoiceCommand>,
    @InjectRepository(VoiceCommandPattern)
    private readonly patternRepo: Repository<VoiceCommandPattern>,
    private readonly llmService: LLMService,
    private readonly actionExecutor: ActionExecutorService,
  ) {}

  async processVoiceCommand(
    userId: string,
    audioData: Buffer,
    context?: Record<string, unknown>,
  ): Promise<VoiceCommandResult> {
    const startTime = Date.now();

    const transcript = await this.transcribeAudio(audioData);

    const interpretation = await this.interpretCommand(transcript, context);

    let result: unknown;
    let executionError: string | undefined;

    if (interpretation.confidence >= 0.7) {
      const actionResult = await this.executeVoiceAction(
        interpretation.intent,
        interpretation.entities,
        userId,
      );
      result = actionResult.result;
      executionError = actionResult.error;
    }

    const executionTime = Date.now() - startTime;

    const command = this.voiceCommandRepo.create({
      userId,
      commandText: transcript,
      intent: interpretation.intent as VoiceIntent,
      entities: interpretation.entities,
      confidence: interpretation.confidence,
      executed: interpretation.confidence >= 0.7 && !executionError,
      executionResult: result ? { result, error: executionError } : null,
      audioDurationMs: null,
    });
    await this.voiceCommandRepo.save(command);

    return {
      commandId: command.id,
      transcript,
      intent: interpretation.intent,
      entities: interpretation.entities,
      confidence: interpretation.confidence,
      action: interpretation.intent,
      result,
      executionTime,
    };
  }

  async processTextCommand(
    userId: string,
    text: string,
    context?: Record<string, unknown>,
  ): Promise<VoiceCommandResult> {
    const startTime = Date.now();

    const interpretation = await this.interpretCommand(text, context);

    let result: unknown;
    let executionError: string | undefined;

    if (interpretation.confidence >= 0.7) {
      const actionResult = await this.executeVoiceAction(
        interpretation.intent,
        interpretation.entities,
        userId,
      );
      result = actionResult.result;
      executionError = actionResult.error;
    }

    const executionTime = Date.now() - startTime;

    const command = this.voiceCommandRepo.create({
      userId,
      commandText: text,
      intent: interpretation.intent as VoiceIntent,
      entities: interpretation.entities,
      confidence: interpretation.confidence,
      executed: interpretation.confidence >= 0.7 && !executionError,
      executionResult: result ? { result, error: executionError } : null,
      audioDurationMs: null,
    });
    await this.voiceCommandRepo.save(command);

    return {
      commandId: command.id,
      transcript: text,
      intent: interpretation.intent,
      entities: interpretation.entities,
      confidence: interpretation.confidence,
      action: interpretation.intent,
      result,
      executionTime,
    };
  }

  private async transcribeAudio(audioData: Buffer): Promise<string> {
    this.logger.debug(`Transcribing audio of size ${audioData.length} bytes`);

    const response = await this.llmService.complete(
      `Transcribe the following audio data. Return only the transcribed text.`,
      undefined,
      { maxTokens: 500 },
    );

    return response.trim();
  }

  private async interpretCommand(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<{
    intent: string;
    entities: Record<string, unknown>;
    confidence: number;
  }> {
    const patterns = await this.patternRepo.find({ where: { isActive: true } });

    const patternExamples = patterns.map(p => ({
      intent: p.intent,
      examples: p.examples,
    }));

    const prompt = `You are a voice command interpreter for an enterprise platform.

Available command intents and examples:
${JSON.stringify(patternExamples, null, 2)}

Current context:
${JSON.stringify(context || {}, null, 2)}

User said: "${transcript}"

Analyze this command and return a JSON object with:
- intent: the matched intent (or "unknown" if no match)
- entities: extracted parameters/entities from the command
- confidence: confidence score 0-1

Return only valid JSON.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 500 },
    );

    try {
      return JSON.parse(response);
    } catch {
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0,
      };
    }
  }

  private async executeVoiceAction(
    intent: string,
    entities: Record<string, unknown>,
    _userId: string,
  ): Promise<{ result: unknown; error?: string }> {
    try {
      // Parse intent as an action
      const action = await this.actionExecutor.parseActionIntent(
        `${intent} ${JSON.stringify(entities)}`,
        { userId: _userId } as never,
      );

      if (!action) {
        return { result: null, error: 'Unknown action intent' };
      }

      return { result: { action, status: 'parsed' } };
    } catch (error) {
      this.logger.error(`Voice action execution failed: ${(error as Error).message}`);
      return { result: null, error: (error as Error).message };
    }
  }

  async registerPattern(pattern: CommandPattern): Promise<VoiceCommandPattern> {
    const existing = await this.patternRepo.findOne({
      where: { intent: pattern.intent },
    });

    if (existing) {
      existing.patterns = [pattern.pattern];
      existing.examples = pattern.examples;
      existing.actionConfig = {
        parameters: pattern.parameters,
      };
      return this.patternRepo.save(existing);
    }

    const newPattern = this.patternRepo.create({
      patterns: [pattern.pattern],
      intent: pattern.intent,
      examples: pattern.examples,
      actionType: 'custom',
      actionConfig: {
        parameters: pattern.parameters,
      },
      isActive: true,
    });

    return this.patternRepo.save(newPattern);
  }

  async getPatterns(): Promise<VoiceCommandPattern[]> {
    return this.patternRepo.find({ where: { isActive: true } });
  }

  async getCommandHistory(
    userId: string,
    limit = 50,
  ): Promise<VoiceCommand[]> {
    return this.voiceCommandRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSupportedCommands(): Promise<Array<{
    intent: string;
    description: string;
    examples: string[];
  }>> {
    const patterns = await this.patternRepo.find({ where: { isActive: true } });

    return patterns.map(p => ({
      intent: p.intent,
      description: p.patterns.join(', '),
      examples: p.examples || [],
    }));
  }
}
