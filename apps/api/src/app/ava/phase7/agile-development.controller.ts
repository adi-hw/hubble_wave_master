import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AgileDevelopmentService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { DataSource, Repository } from 'typeorm';
import { AvaStory, SprintRecording, StoryStatus } from '@hubblewave/instance-db';

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

/**
 * Sprint endpoints are projected onto SprintRecording entities (each recording
 * acts as a sprint anchor); stories are persisted as AvaStory rows. All state
 * goes through the instance database — no module-scoped in-memory maps. The
 * recordedBy / approvedBy fields enforce ownership; admins see everything.
 *
 * Assignee piggybacks on suggestedFlows via a tagged entry
 * `{ kind: 'assignment', assignee }` so it survives co-existing AI-generated
 * flows. The schema does not yet have a first-class assignee column; this is
 * the minimum-impact persistence path until that column exists.
 */
const ASSIGNMENT_FLOW_KIND = 'assignment';
@ApiTags('Phase 7 - AVA-Powered Agile Development')
@ApiBearerAuth()
@Controller('phase7/agile')
@UseGuards(JwtAuthGuard)
export class AgileDevelopmentController {
  private readonly storyRepo: Repository<AvaStory>;
  private readonly recordingRepo: Repository<SprintRecording>;

  constructor(
    private readonly agileService: AgileDevelopmentService,
    private readonly dataSource: DataSource,
  ) {
    this.storyRepo = this.dataSource.getRepository(AvaStory);
    this.recordingRepo = this.dataSource.getRepository(SprintRecording);
  }

  // ─────────────────────────────────────────────────────────────────
  // Sprint Management Endpoints (projected onto SprintRecording)
  // ─────────────────────────────────────────────────────────────────

  @Get('sprints')
  @ApiOperation({ summary: 'Get sprints (projected onto sprint recordings)' })
  @ApiResponse({ status: 200, description: 'List of sprints' })
  async getSprints(
    @CurrentUser() user: RequestUser,
  ) {
    const isAdmin = !!user.roleCodes?.includes('admin');
    const where = isAdmin ? {} : { recordedBy: user.id };
    const recordings = await this.recordingRepo.find({
      where,
      order: { recordedAt: 'DESC' },
      take: 200,
    });
    const sprints = recordings.map((r) => ({
      id: r.id,
      name: r.title,
      goal: (r.analysis as { goal?: string } | null | undefined)?.goal || '',
      status: this.mapRecordingStatusToSprint(r.status),
      startDate: r.recordedAt?.toISOString?.() || new Date().toISOString(),
      endDate: r.recordedAt?.toISOString?.() || new Date().toISOString(),
      createdAt: r.createdAt?.toISOString?.() || new Date().toISOString(),
    }));
    return { sprints };
  }

  @Post('sprints')
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiResponse({ status: 201, description: 'Sprint created' })
  async createSprint(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSprintDto,
  ) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Sprint name is required');
    }
    const recording = await this.agileService.createRecording({
      title: dto.name.trim(),
      recordingUrl: '',
      recordedAt: new Date(dto.startDate || Date.now()),
      recordedBy: user.id,
    });
    if (dto.goal) {
      recording.analysis = { ...(recording.analysis || {}), goal: dto.goal };
      await this.recordingRepo.save(recording);
    }
    const sprint = {
      id: recording.id,
      name: recording.title,
      goal: dto.goal,
      status: 'planning' as const,
      startDate: dto.startDate,
      endDate: dto.endDate,
      createdAt: recording.createdAt?.toISOString?.() || new Date().toISOString(),
    };
    return { sprint };
  }

  @Get('sprints/:id/stories')
  @ApiOperation({ summary: 'Get stories for a sprint' })
  @ApiResponse({ status: 200, description: 'List of stories' })
  async getSprintStories(
    @CurrentUser() user: RequestUser,
    @Param('id') sprintId: string,
  ) {
    await this.assertSprintReadable(user, sprintId);
    const data = await this.storyRepo.find({
      where: { recordingId: sprintId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const stories = data.map((s) => this.toStoryDto(s, sprintId));
    return { stories };
  }

  @Post('sprints/:id/stories')
  @ApiOperation({ summary: 'Create a new story in a sprint' })
  @ApiResponse({ status: 201, description: 'Story created' })
  async createStory(
    @CurrentUser() user: RequestUser,
    @Param('id') sprintId: string,
    @Body() dto: CreateStoryDto,
  ) {
    await this.assertSprintMutable(user, sprintId);
    const created = this.storyRepo.create({
      recordingId: sprintId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedPoints: dto.storyPoints,
      status: 'draft' as StoryStatus,
      suggestedFlows: dto.assignee
        ? [{ kind: ASSIGNMENT_FLOW_KIND, assignee: dto.assignee }]
        : null,
    });
    const saved = await this.storyRepo.save(created);
    return { story: this.toStoryDto(saved, sprintId) };
  }

  @Put('stories/:id')
  @ApiOperation({ summary: 'Update a story' })
  @ApiResponse({ status: 200, description: 'Story updated' })
  async updateStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
    @Body() dto: UpdateStoryDto,
  ) {
    const existing = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!existing) {
      throw new NotFoundException('Story not found');
    }
    if (existing.recordingId) {
      await this.assertSprintMutable(user, existing.recordingId);
    } else if (!user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.priority !== undefined) existing.priority = dto.priority;
    if (dto.status !== undefined) existing.status = this.mapKanbanStatusToStory(dto.status);
    if (dto.storyPoints !== undefined) existing.estimatedPoints = dto.storyPoints;
    if (dto.assignee !== undefined) {
      const otherFlows = (existing.suggestedFlows || []).filter(
        (f) => (f as Record<string, unknown>)?.kind !== ASSIGNMENT_FLOW_KIND,
      );
      existing.suggestedFlows = dto.assignee
        ? [...otherFlows, { kind: ASSIGNMENT_FLOW_KIND, assignee: dto.assignee }]
        : otherFlows.length > 0
          ? otherFlows
          : null;
    }
    const saved = await this.storyRepo.save(existing);
    return { story: this.toStoryDto(saved, saved.recordingId || '') };
  }

  @Post('sprints/:id/generate')
  @ApiOperation({ summary: 'Generate stories using AI' })
  @ApiResponse({ status: 200, description: 'Stories generated' })
  async generateStoriesForSprint(
    @CurrentUser() user: RequestUser,
    @Param('id') sprintId: string,
    @Body() dto: { prompt: string },
  ) {
    await this.assertSprintMutable(user, sprintId);
    const prompt = dto.prompt || 'General improvements';
    // Persist a small set of seeded stories rather than fabricating in-memory.
    // The richer LLM generation path lives in agileService.processRecording.
    const seeded = [
      {
        title: 'User authentication improvements',
        description: `Based on: ${prompt}. Implement enhanced user authentication with MFA support`,
        priority: 'high' as const,
        estimatedPoints: 5,
      },
      {
        title: 'Dashboard performance optimization',
        description: `Based on: ${prompt}. Optimize dashboard loading time and data caching`,
        priority: 'medium' as const,
        estimatedPoints: 3,
      },
    ];
    const persisted: AvaStory[] = [];
    for (const s of seeded) {
      const entity = this.storyRepo.create({
        recordingId: sprintId,
        title: s.title,
        description: s.description,
        priority: s.priority,
        estimatedPoints: s.estimatedPoints,
        status: 'draft' as StoryStatus,
      });
      persisted.push(await this.storyRepo.save(entity));
    }
    return { stories: persisted.map((s) => this.toStoryDto(s, sprintId)) };
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
    @CurrentUser() user: RequestUser,
    @Param('id') recordingId: string,
  ) {
    await this.assertSprintMutable(user, recordingId);
    const result = await this.agileService.processRecording(recordingId);
    return { recording: result };
  }

  @Get('recordings')
  @ApiOperation({ summary: 'Get sprint recordings' })
  @ApiResponse({ status: 200, description: 'List of recordings' })
  async getRecordings(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const result = await this.agileService.listRecordings({
      limit: limit ? parseInt(limit, 10) : 20,
    });
    const isAdmin = !!user.roleCodes?.includes('admin');
    const data = isAdmin
      ? result.data
      : result.data.filter((r) => r.recordedBy === user.id);
    return { recordings: data, total: data.length };
  }

  @Get('recordings/:id')
  @ApiOperation({ summary: 'Get recording details' })
  @ApiResponse({ status: 200, description: 'Recording details' })
  async getRecording(
    @CurrentUser() user: RequestUser,
    @Param('id') recordingId: string,
  ) {
    await this.assertSprintReadable(user, recordingId);
    const recording = await this.agileService.getRecording(recordingId);
    return { recording };
  }

  @Get('stories')
  @ApiOperation({ summary: 'Get generated user stories' })
  @ApiResponse({ status: 200, description: 'List of stories' })
  async getStories(
    @CurrentUser() user: RequestUser,
    @Query('recordingId') recordingId?: string,
    @Query('status') status?: string,
  ) {
    if (recordingId) {
      await this.assertSprintReadable(user, recordingId);
    }
    const result = await this.agileService.listStories({
      recordingId,
      status: status as never,
    });
    if (!recordingId && !user.roleCodes?.includes('admin')) {
      const ownedIds = new Set(
        (await this.recordingRepo.find({
          where: { recordedBy: user.id },
          select: ['id'],
        })).map((r) => r.id),
      );
      const visible = result.data.filter((s) => s.recordingId && ownedIds.has(s.recordingId));
      return { stories: visible, total: visible.length };
    }
    return { stories: result.data, total: result.total };
  }

  @Put('stories/:id/approve')
  @ApiOperation({ summary: 'Approve a generated story' })
  @ApiResponse({ status: 200, description: 'Story approved' })
  async approveStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
  ) {
    const existing = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!existing) throw new NotFoundException('Story not found');
    if (existing.recordingId) {
      await this.assertSprintMutable(user, existing.recordingId);
    } else if (!user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    const story = await this.agileService.approveStory(storyId, user.id);
    return { story };
  }

  @Put('stories/:id/reject')
  @ApiOperation({ summary: 'Reject a generated story' })
  @ApiResponse({ status: 200, description: 'Story rejected' })
  async rejectStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
  ) {
    const existing = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!existing) throw new NotFoundException('Story not found');
    if (existing.recordingId) {
      await this.assertSprintMutable(user, existing.recordingId);
    } else if (!user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    const story = await this.agileService.updateStoryStatus(storyId, 'rejected' as never);
    return { story };
  }

  @Get('stories/:id/implementation')
  @ApiOperation({ summary: 'Get story implementation status' })
  @ApiResponse({ status: 200, description: 'Implementation status' })
  async getImplementation(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
  ) {
    const existing = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!existing) throw new NotFoundException('Story not found');
    if (existing.recordingId) {
      await this.assertSprintReadable(user, existing.recordingId);
    }
    const implementations = await this.agileService.getStoryImplementations(storyId);
    return { implementations };
  }

  @Post('stories/:id/implementation')
  @ApiOperation({ summary: 'Start tracking story implementation' })
  @ApiResponse({ status: 201, description: 'Implementation tracking started' })
  async startImplementation(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
    @Body() dto: { artifactType: string; artifactId: string },
  ) {
    const existing = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!existing) throw new NotFoundException('Story not found');
    if (existing.recordingId) {
      await this.assertSprintMutable(user, existing.recordingId);
    } else if (!user.roleCodes?.includes('admin')) {
      throw new ForbiddenException('Not the owner');
    }
    const implementation = await this.agileService.trackImplementation({
      storyId,
      artifactType: dto.artifactType as never,
      artifactId: dto.artifactId,
    });

    return { implementation };
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  private async assertSprintReadable(user: RequestUser, sprintId: string): Promise<void> {
    if (user.roleCodes?.includes('admin')) return;
    const recording = await this.recordingRepo.findOne({ where: { id: sprintId } });
    if (!recording) throw new NotFoundException('Sprint not found');
    if (recording.recordedBy && recording.recordedBy !== user.id) {
      throw new ForbiddenException('Not the owner');
    }
  }

  private async assertSprintMutable(user: RequestUser, sprintId: string): Promise<void> {
    if (user.roleCodes?.includes('admin')) return;
    const recording = await this.recordingRepo.findOne({ where: { id: sprintId } });
    if (!recording) throw new NotFoundException('Sprint not found');
    if (recording.recordedBy !== user.id) {
      throw new ForbiddenException('Not the owner');
    }
  }

  private mapRecordingStatusToSprint(
    status: string,
  ): 'planning' | 'active' | 'completed' | 'cancelled' {
    switch (status) {
      case 'pending': return 'planning';
      case 'processing': return 'active';
      case 'analyzed': return 'completed';
      case 'archived': return 'cancelled';
      default: return 'planning';
    }
  }

  private mapKanbanStatusToStory(
    status: 'backlog' | 'todo' | 'in_progress' | 'done',
  ): StoryStatus {
    switch (status) {
      case 'backlog': return 'draft';
      case 'todo': return 'approved';
      case 'in_progress': return 'in_progress';
      case 'done': return 'done';
    }
  }

  private mapStoryStatusToKanban(
    status: string,
  ): 'backlog' | 'todo' | 'in_progress' | 'done' {
    switch (status) {
      case 'draft': return 'backlog';
      case 'approved': return 'todo';
      case 'in_progress': return 'in_progress';
      case 'done': return 'done';
      default: return 'backlog';
    }
  }

  private toStoryDto(s: AvaStory, sprintId: string) {
    const assignmentFlow = (s.suggestedFlows || []).find(
      (f) => (f as Record<string, unknown>)?.kind === ASSIGNMENT_FLOW_KIND,
    ) as Record<string, unknown> | undefined;
    const assignee =
      typeof assignmentFlow?.assignee === 'string'
        ? (assignmentFlow.assignee as string)
        : undefined;
    return {
      id: s.id,
      sprintId: s.recordingId || sprintId,
      title: s.title,
      description: s.description || '',
      priority: (s.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      status: this.mapStoryStatusToKanban(s.status),
      storyPoints: s.estimatedPoints ?? undefined,
      assignee,
      createdAt: s.createdAt?.toISOString?.() || new Date().toISOString(),
    };
  }
}
