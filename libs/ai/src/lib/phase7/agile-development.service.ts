import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SprintRecording,
  AvaStory,
  StoryImplementation,
  SprintRecordingStatus,
  StoryStatus,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

interface TranscriptionResult {
  text: string;
  duration: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
}

interface StoryAnalysis {
  stories: Array<{
    title: string;
    role: string;
    action: string;
    benefit: string;
    acceptance_criteria: Array<{ criterion: string; testable: boolean }>;
    suggested_collections: Array<{
      code: string;
      name: string;
      properties: Array<{ code: string; type: string; ref?: string }>;
    }>;
    suggested_rules: Array<{
      trigger: string;
      condition: string;
      action: string;
    }>;
    estimated_points: number;
    priority: string;
    story_type: string;
  }>;
}

const STORY_GENERATION_PROMPT = `You are analyzing a sprint planning meeting transcript for an enterprise platform.

Your task is to identify features/requirements and generate structured user stories.

For each feature identified:
1. Create a user story in the format: "As a [role], I want to [action], so that [benefit]"
2. Extract testable acceptance criteria
3. Suggest the database Collections and Properties needed
4. Suggest Automation Rules that might be needed
5. Estimate complexity in story points (1, 2, 3, 5, 8, 13)
6. Assign priority (critical, high, medium, low)
7. Classify story type (feature, enhancement, bug, chore)

Output ONLY valid JSON with this structure:
{
  "stories": [
    {
      "title": "Brief title",
      "role": "user role",
      "action": "what user wants to do",
      "benefit": "why they want it",
      "acceptance_criteria": [
        { "criterion": "Testable statement", "testable": true }
      ],
      "suggested_collections": [
        {
          "code": "snake_case_code",
          "name": "Human Readable Name",
          "properties": [
            { "code": "property_code", "type": "string|number|date|reference", "ref": "optional_reference_collection" }
          ]
        }
      ],
      "suggested_rules": [
        { "trigger": "on_create|on_update|on_delete", "condition": "field equals value", "action": "set_field|send_notification|etc" }
      ],
      "estimated_points": 5,
      "priority": "medium",
      "story_type": "feature"
    }
  ]
}`;

@Injectable()
export class AgileDevelopmentService {
  private readonly logger = new Logger(AgileDevelopmentService.name);

  constructor(
    @InjectRepository(SprintRecording)
    private readonly recordingRepo: Repository<SprintRecording>,
    @InjectRepository(AvaStory)
    private readonly storyRepo: Repository<AvaStory>,
    @InjectRepository(StoryImplementation)
    private readonly implementationRepo: Repository<StoryImplementation>,
    private readonly llmService: LLMService,
  ) {}

  async createRecording(data: {
    title: string;
    recordingUrl: string;
    recordedAt: Date;
    recordedBy: string;
  }): Promise<SprintRecording> {
    const recording = this.recordingRepo.create({
      ...data,
      status: 'pending' as SprintRecordingStatus,
    });
    return this.recordingRepo.save(recording);
  }

  async processRecording(id: string): Promise<SprintRecording> {
    const recording = await this.recordingRepo.findOneOrFail({ where: { id } });

    recording.status = 'processing';
    await this.recordingRepo.save(recording);

    try {
      const transcription = await this.transcribe(recording.recordingUrl ?? '');
      recording.transcript = transcription.text;
      recording.durationSeconds = transcription.duration;

      const analysis = await this.analyzeTranscript(transcription.text);
      recording.analysis = analysis as unknown as Record<string, unknown>;

      await this.generateStories(recording.id, analysis);

      recording.status = 'analyzed';
    } catch (error) {
      this.logger.error(`Failed to process recording ${id}`, error);
      recording.status = 'pending';
      recording.analysis = { error: (error as Error).message };
    }

    return this.recordingRepo.save(recording);
  }

  private async transcribe(recordingUrl: string): Promise<TranscriptionResult> {
    // Integration with Whisper or similar transcription service
    // For now, return a mock if URL is empty (for testing)
    if (!recordingUrl) {
      return { text: '', duration: 0 };
    }

    // Call external transcription service
    // This would integrate with Whisper API or similar
    const response = await this.llmService.complete(
      `Transcribe the audio from: ${recordingUrl}`,
      'You are a transcription assistant.',
    );

    return {
      text: response,
      duration: 0,
    };
  }

  private async analyzeTranscript(transcript: string): Promise<StoryAnalysis> {
    if (!transcript || transcript.trim().length === 0) {
      return { stories: [] };
    }

    const response = await this.llmService.complete(
      `Analyze this sprint planning transcript and generate user stories:\n\n${transcript}`,
      STORY_GENERATION_PROMPT,
    );

    try {
      return JSON.parse(response);
    } catch {
      this.logger.warn('Failed to parse story analysis, returning empty result');
      return { stories: [] };
    }
  }

  private async generateStories(recordingId: string, analysis: StoryAnalysis): Promise<AvaStory[]> {
    const stories: AvaStory[] = [];

    for (const storyData of analysis.stories) {
      const story = this.storyRepo.create({
        recordingId,
        title: storyData.title,
        description: `As a ${storyData.role}, I want to ${storyData.action}, so that ${storyData.benefit}`,
        storyType: storyData.story_type as AvaStory['storyType'],
        priority: storyData.priority as AvaStory['priority'],
        estimatedPoints: storyData.estimated_points,
        acceptanceCriteria: storyData.acceptance_criteria,
        suggestedCollections: storyData.suggested_collections,
        suggestedRules: storyData.suggested_rules,
        status: 'draft' as StoryStatus,
      });

      stories.push(await this.storyRepo.save(story));
    }

    return stories;
  }

  async getRecording(id: string): Promise<SprintRecording> {
    return this.recordingRepo.findOneOrFail({
      where: { id },
      relations: ['stories', 'recordedByUser'],
    });
  }

  async listRecordings(options: {
    status?: SprintRecordingStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SprintRecording[]; total: number }> {
    const query = this.recordingRepo.createQueryBuilder('recording')
      .leftJoinAndSelect('recording.stories', 'stories')
      .leftJoinAndSelect('recording.recordedByUser', 'user');

    if (options.status) {
      query.andWhere('recording.status = :status', { status: options.status });
    }

    const [data, total] = await query
      .orderBy('recording.recordedAt', 'DESC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async getStory(id: string): Promise<AvaStory> {
    return this.storyRepo.findOneOrFail({
      where: { id },
      relations: ['recording', 'implementations', 'approvedByUser'],
    });
  }

  async listStories(options: {
    recordingId?: string;
    status?: StoryStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AvaStory[]; total: number }> {
    const query = this.storyRepo.createQueryBuilder('story')
      .leftJoinAndSelect('story.recording', 'recording');

    if (options.recordingId) {
      query.andWhere('story.recordingId = :recordingId', { recordingId: options.recordingId });
    }

    if (options.status) {
      query.andWhere('story.status = :status', { status: options.status });
    }

    const [data, total] = await query
      .orderBy('story.createdAt', 'DESC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async approveStory(storyId: string, userId: string): Promise<AvaStory> {
    const story = await this.storyRepo.findOneOrFail({ where: { id: storyId } });
    story.status = 'approved';
    story.approvedBy = userId;
    story.approvedAt = new Date();
    return this.storyRepo.save(story);
  }

  async updateStoryStatus(storyId: string, status: StoryStatus): Promise<AvaStory> {
    const story = await this.storyRepo.findOneOrFail({ where: { id: storyId } });
    story.status = status;
    return this.storyRepo.save(story);
  }

  async trackImplementation(data: {
    storyId: string;
    artifactType: StoryImplementation['artifactType'];
    artifactId: string;
    generatedByAva?: boolean;
  }): Promise<StoryImplementation> {
    const implementation = this.implementationRepo.create({
      ...data,
      generatedByAva: data.generatedByAva ?? true,
    });
    return this.implementationRepo.save(implementation);
  }

  async getStoryImplementations(storyId: string): Promise<StoryImplementation[]> {
    return this.implementationRepo.find({
      where: { storyId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteRecording(id: string): Promise<void> {
    await this.recordingRepo.delete(id);
  }

  async deleteStory(id: string): Promise<void> {
    await this.storyRepo.delete(id);
  }
}
