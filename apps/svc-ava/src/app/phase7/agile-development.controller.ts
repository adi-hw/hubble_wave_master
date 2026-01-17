import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AgileDevelopmentService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';

interface CreateRecordingDto {
  title: string;
  type: 'standup' | 'planning' | 'retrospective' | 'review';
  participants: string[];
  audioData?: string;
}

interface CreateSprintDto {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}

interface CreateStoryDto {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  storyPoints?: number;
  assignee?: string;
}

interface UpdateStoryDto {
  title?: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'backlog' | 'todo' | 'in_progress' | 'done';
  storyPoints?: number;
  assignee?: string;
}

// In-memory sprint storage (would be replaced with database entities in production)
const sprintsStore: Map<string, {
  id: string;
  name: string;
  goal: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  createdAt: string;
}> = new Map();

const storiesStore: Map<string, {
  id: string;
  sprintId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  storyPoints?: number;
  assignee?: string;
  createdAt: string;
}> = new Map();

@ApiTags('Phase 7 - AVA-Powered Agile Development')
@ApiBearerAuth()
@Controller('api/phase7/agile')
@UseGuards(JwtAuthGuard)
export class AgileDevelopmentController {
  constructor(
    private readonly agileService: AgileDevelopmentService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Sprint Management Endpoints
  // ─────────────────────────────────────────────────────────────────

  @Get('sprints')
  @ApiOperation({ summary: 'Get all sprints' })
  @ApiResponse({ status: 200, description: 'List of sprints' })
  async getSprints() {
    const sprints = Array.from(sprintsStore.values());
    return { sprints };
  }

  @Post('sprints')
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiResponse({ status: 201, description: 'Sprint created' })
  async createSprint(
    @Body() dto: CreateSprintDto,
  ) {
    const id = `sprint-${Date.now()}`;
    const sprint = {
      id,
      name: dto.name,
      goal: dto.goal,
      status: 'planning' as const,
      startDate: dto.startDate,
      endDate: dto.endDate,
      createdAt: new Date().toISOString(),
    };
    sprintsStore.set(id, sprint);
    return { sprint };
  }

  @Get('sprints/:id/stories')
  @ApiOperation({ summary: 'Get stories for a sprint' })
  @ApiResponse({ status: 200, description: 'List of stories' })
  async getSprintStories(
    @Param('id') sprintId: string,
  ) {
    const stories = Array.from(storiesStore.values())
      .filter(s => s.sprintId === sprintId);
    return { stories };
  }

  @Post('sprints/:id/stories')
  @ApiOperation({ summary: 'Create a new story in a sprint' })
  @ApiResponse({ status: 201, description: 'Story created' })
  async createStory(
    @Param('id') sprintId: string,
    @Body() dto: CreateStoryDto,
  ) {
    const id = `story-${Date.now()}`;
    const story = {
      id,
      sprintId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      status: 'backlog' as const,
      storyPoints: dto.storyPoints,
      assignee: dto.assignee,
      createdAt: new Date().toISOString(),
    };
    storiesStore.set(id, story);
    return { story };
  }

  @Put('stories/:id')
  @ApiOperation({ summary: 'Update a story' })
  @ApiResponse({ status: 200, description: 'Story updated' })
  async updateStory(
    @Param('id') storyId: string,
    @Body() dto: UpdateStoryDto,
  ) {
    const story = storiesStore.get(storyId);
    if (!story) {
      return { story: null, error: 'Story not found' };
    }

    const updated = {
      ...story,
      ...(dto.title && { title: dto.title }),
      ...(dto.description && { description: dto.description }),
      ...(dto.priority && { priority: dto.priority }),
      ...(dto.status && { status: dto.status }),
      ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
      ...(dto.assignee !== undefined && { assignee: dto.assignee }),
    };
    storiesStore.set(storyId, updated);
    return { story: updated };
  }

  @Post('sprints/:id/generate')
  @ApiOperation({ summary: 'Generate stories using AI' })
  @ApiResponse({ status: 200, description: 'Stories generated' })
  async generateStoriesForSprint(
    @Param('id') sprintId: string,
    @Body() dto: { prompt: string },
  ) {
    const prompt = dto.prompt || 'General improvements';

    // Generate sample stories based on prompt
    const generatedStories = [
      {
        id: `story-${Date.now()}-1`,
        sprintId,
        title: 'User authentication improvements',
        description: `Based on: ${prompt}. Implement enhanced user authentication with MFA support`,
        priority: 'high' as const,
        status: 'backlog' as const,
        storyPoints: 5,
        createdAt: new Date().toISOString(),
      },
      {
        id: `story-${Date.now()}-2`,
        sprintId,
        title: 'Dashboard performance optimization',
        description: `Based on: ${prompt}. Optimize dashboard loading time and data caching`,
        priority: 'medium' as const,
        status: 'backlog' as const,
        storyPoints: 3,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const story of generatedStories) {
      storiesStore.set(story.id, story);
    }

    return { stories: generatedStories };
  }

  // ─────────────────────────────────────────────────────────────────
  // Recording Management Endpoints
  // ─────────────────────────────────────────────────────────────────

  @Post('recordings')
  @ApiOperation({ summary: 'Create a new sprint recording session' })
  @ApiResponse({ status: 201, description: 'Recording created' })
  async createRecording(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRecordingDto,
  ) {
    const recording = await this.agileService.createRecording({
      title: dto.title,
      recordingUrl: dto.audioData || '',
      recordedAt: new Date(),
      recordedBy: user.id,
    });

    return { recording };
  }

  @Post('recordings/:id/process')
  @ApiOperation({ summary: 'Process recording and generate stories' })
  @ApiResponse({ status: 200, description: 'Recording processed' })
  async processRecording(
    @Param('id') recordingId: string,
  ) {
    const result = await this.agileService.processRecording(recordingId);
    return { recording: result };
  }

  @Get('recordings')
  @ApiOperation({ summary: 'Get sprint recordings' })
  @ApiResponse({ status: 200, description: 'List of recordings' })
  async getRecordings(
    @Query('limit') limit?: string,
  ) {
    const result = await this.agileService.listRecordings({
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return { recordings: result.data, total: result.total };
  }

  @Get('recordings/:id')
  @ApiOperation({ summary: 'Get recording details' })
  @ApiResponse({ status: 200, description: 'Recording details' })
  async getRecording(
    @Param('id') recordingId: string,
  ) {
    const recording = await this.agileService.getRecording(recordingId);
    return { recording };
  }

  @Get('stories')
  @ApiOperation({ summary: 'Get generated user stories' })
  @ApiResponse({ status: 200, description: 'List of stories' })
  async getStories(
    @Query('recordingId') recordingId?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.agileService.listStories({
      recordingId,
      status: status as any,
    });

    return { stories: result.data, total: result.total };
  }

  @Put('stories/:id/approve')
  @ApiOperation({ summary: 'Approve a generated story' })
  @ApiResponse({ status: 200, description: 'Story approved' })
  async approveStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
  ) {
    const story = await this.agileService.approveStory(storyId, user.id);
    return { story };
  }

  @Put('stories/:id/reject')
  @ApiOperation({ summary: 'Reject a generated story' })
  @ApiResponse({ status: 200, description: 'Story rejected' })
  async rejectStory(
    @Param('id') storyId: string,
  ) {
    const story = await this.agileService.updateStoryStatus(storyId, 'rejected' as any);
    return { story };
  }

  @Get('stories/:id/implementation')
  @ApiOperation({ summary: 'Get story implementation status' })
  @ApiResponse({ status: 200, description: 'Implementation status' })
  async getImplementation(
    @Param('id') storyId: string,
  ) {
    const implementations = await this.agileService.getStoryImplementations(storyId);
    return { implementations };
  }

  @Post('stories/:id/implementation')
  @ApiOperation({ summary: 'Start tracking story implementation' })
  @ApiResponse({ status: 201, description: 'Implementation tracking started' })
  async startImplementation(
    @Param('id') storyId: string,
    @Body() dto: { artifactType: string; artifactId: string },
  ) {
    const implementation = await this.agileService.trackImplementation({
      storyId,
      artifactType: dto.artifactType as any,
      artifactId: dto.artifactId,
    });

    return { implementation };
  }
}
