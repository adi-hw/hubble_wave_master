// ============================================================
// Phase 7: Zero-Code App Builder Service
// Natural language to functional applications
// ============================================================

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  AppStatus,
  AppDefinition,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

interface AppSpec {
  name: string;
  description: string;
  collections: Array<{
    name: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
      validation?: Record<string, unknown>;
    }>;
  }>;
  views: Array<{
    name: string;
    type: 'grid' | 'form' | 'dashboard' | 'kanban';
    collection: string;
    config: Record<string, unknown>;
  }>;
  processFlows: Array<{
    name: string;
    trigger: string;
    steps: Array<{
      type: string;
      config: Record<string, unknown>;
    }>;
  }>;
  navigation: Array<{
    label: string;
    icon: string;
    path: string;
  }>;
}

interface BuildProgress {
  phase: string;
  step: number;
  totalSteps: number;
  message: string;
}

@Injectable()
export class AppBuilderService {
  constructor(
    @InjectRepository(ZeroCodeApp)
    private readonly appRepo: Repository<ZeroCodeApp>,
    @InjectRepository(ZeroCodeAppVersion)
    private readonly versionRepo: Repository<ZeroCodeAppVersion>,
    @InjectRepository(AppBuilderComponent)
    private readonly componentRepo: Repository<AppBuilderComponent>,
    private readonly llmService: LLMService,
  ) {}

  async generateAppFromDescription(
    userId: string,
    description: string,
    options?: {
      style?: 'minimal' | 'standard' | 'comprehensive';
      targetUsers?: string;
    },
  ): Promise<{ appId: string; spec: AppSpec }> {
    const app = this.appRepo.create({
      name: 'Generating...',
      description,
      version: '1.0.0',
      createdBy: userId,
      definition: { pages: [] },
      isPublished: false,
    });
    await this.appRepo.save(app);

    const spec = await this.generateSpec(description, options);

    app.name = spec.name;
    app.definition = spec as unknown as AppDefinition;
    await this.appRepo.save(app);

    const version = this.versionRepo.create({
      appId: app.id,
      version: '1.0.0',
      definition: spec as unknown as AppDefinition,
      changeSummary: 'Initial generation from description',
      createdBy: userId,
    });
    await this.versionRepo.save(version);

    return { appId: app.id, spec };
  }

  private async generateSpec(
    description: string,
    options?: {
      style?: 'minimal' | 'standard' | 'comprehensive';
      targetUsers?: string;
    },
  ): Promise<AppSpec> {
    const style = options?.style || 'standard';
    const targetUsers = options?.targetUsers || 'general business users';

    const prompt = `You are an enterprise application architect. Generate a complete application specification based on this description:

"${description}"

Style: ${style}
Target Users: ${targetUsers}

Generate a JSON specification with:
1. name: Application name
2. description: Clear description
3. collections: Data models with properties (name, type, required, validation)
4. views: UI views (grid, form, dashboard, kanban) with configurations
5. processFlows: Automation process flows with triggers and steps
6. navigation: Menu structure with labels, icons, and paths

Property types: text, number, date, datetime, boolean, select, multiselect, relation, file, image, richtext, email, url, phone, currency, percentage

For ${style} style:
- minimal: 2-3 collections, basic views, simple process flows
- standard: 4-6 collections, comprehensive views, moderate process flows
- comprehensive: 7+ collections, advanced views, complex process flows

Return only valid JSON.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 4000 },
    );

    try {
      return JSON.parse(response);
    } catch {
      return this.getDefaultSpec(description);
    }
  }

  private getDefaultSpec(description: string): AppSpec {
    return {
      name: 'New Application',
      description,
      collections: [
        {
          name: 'Items',
          properties: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'richtext', required: false },
            { name: 'status', type: 'select', required: true },
            { name: 'createdAt', type: 'datetime', required: true },
          ],
        },
      ],
      views: [
        {
          name: 'All Items',
          type: 'grid',
          collection: 'Items',
          config: { columns: ['name', 'status', 'createdAt'] },
        },
        {
          name: 'Item Form',
          type: 'form',
          collection: 'Items',
          config: { fields: ['name', 'description', 'status'] },
        },
      ],
      processFlows: [],
      navigation: [
        { label: 'Items', icon: 'list', path: '/items' },
      ],
    };
  }

  async refineApp(
    appId: string,
    userId: string,
    refinement: string,
  ): Promise<AppSpec> {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) {
      throw new Error('App not found');
    }

    const prompt = `You are refining an existing application specification.

Current Specification:
${JSON.stringify(app.definition, null, 2)}

User Refinement Request:
"${refinement}"

Apply the refinement and return the updated complete specification as JSON.
Maintain the existing structure and only modify what's necessary.`;

    const response = await this.llmService.complete(
      prompt,
      undefined,
      { maxTokens: 4000 },
    );

    let newSpec: AppSpec;
    try {
      newSpec = JSON.parse(response);
    } catch {
      throw new Error('Failed to parse refined specification');
    }

    const currentVersion = await this.versionRepo.findOne({
      where: { appId },
      order: { createdAt: 'DESC' },
    });

    const versionParts = (currentVersion?.version || '0.0.0').split('.');
    const newVersion = `${versionParts[0]}.${parseInt(versionParts[1], 10) + 1}.0`;

    const version = this.versionRepo.create({
      appId,
      version: newVersion,
      definition: newSpec as unknown as AppDefinition,
      changeSummary: refinement,
      createdBy: userId,
    });
    await this.versionRepo.save(version);

    app.definition = newSpec as unknown as AppDefinition;
    await this.appRepo.save(app);

    return newSpec;
  }

  async buildApp(
    appId: string,
    _userId: string,
    onProgress?: (progress: BuildProgress) => void,
  ): Promise<{ success: boolean; errors: string[] }> {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) {
      throw new Error('App not found');
    }

    const spec = app.definition as unknown as AppSpec;
    const errors: string[] = [];
    const totalSteps = spec.collections.length + spec.views.length + spec.processFlows.length + 1;
    let step = 0;

    for (const collection of spec.collections) {
      step++;
      onProgress?.({
        phase: 'collections',
        step,
        totalSteps,
        message: `Creating collection: ${collection.name}`,
      });

      const validationResult = this.validateCollection(collection);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
      }
    }

    for (const view of spec.views) {
      step++;
      onProgress?.({
        phase: 'views',
        step,
        totalSteps,
        message: `Creating view: ${view.name}`,
      });

      const validationResult = this.validateView(view, spec.collections);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
      }
    }

    for (const processFlow of spec.processFlows) {
      step++;
      onProgress?.({
        phase: 'processFlows',
        step,
        totalSteps,
        message: `Creating process flow: ${processFlow.name}`,
      });

      const validationResult = this.validateProcessFlow(processFlow);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
      }
    }

    step++;
    onProgress?.({
      phase: 'finalize',
      step,
      totalSteps,
      message: 'Finalizing application',
    });

    if (errors.length === 0) {
      app.isPublished = true;
      app.publishedVersion = app.version;
      app.publishedAt = new Date();
    }
    await this.appRepo.save(app);

    return { success: errors.length === 0, errors };
  }

  private validateCollection(collection: AppSpec['collections'][0]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!collection.name || collection.name.trim() === '') {
      errors.push('Collection name is required');
    }

    if (!collection.properties || collection.properties.length === 0) {
      errors.push(`Collection ${collection.name} must have at least one property`);
    }

    const validTypes = [
      'text', 'number', 'date', 'datetime', 'boolean', 'select',
      'multiselect', 'relation', 'file', 'image', 'richtext',
      'email', 'url', 'phone', 'currency', 'percentage',
    ];

    for (const prop of collection.properties || []) {
      if (!validTypes.includes(prop.type)) {
        errors.push(`Invalid property type: ${prop.type} in ${collection.name}.${prop.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateView(
    view: AppSpec['views'][0],
    collections: AppSpec['collections'],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!view.name || view.name.trim() === '') {
      errors.push('View name is required');
    }

    const validTypes = ['grid', 'form', 'dashboard', 'kanban'];
    if (!validTypes.includes(view.type)) {
      errors.push(`Invalid view type: ${view.type}`);
    }

    const collectionExists = collections.some(c => c.name === view.collection);
    if (!collectionExists) {
      errors.push(`View ${view.name} references non-existent collection: ${view.collection}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateProcessFlow(processFlow: AppSpec['processFlows'][0]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!processFlow.name || processFlow.name.trim() === '') {
      errors.push('Process flow name is required');
    }

    if (!processFlow.trigger) {
      errors.push(`Process flow ${processFlow.name} must have a trigger`);
    }

    if (!processFlow.steps || processFlow.steps.length === 0) {
      errors.push(`Process flow ${processFlow.name} must have at least one step`);
    }

    return { valid: errors.length === 0, errors };
  }

  async getApp(appId: string): Promise<ZeroCodeApp | null> {
    return this.appRepo.findOne({ where: { id: appId } });
  }

  async listApps(
    userId: string,
    _options?: { status?: AppStatus },
  ): Promise<ZeroCodeApp[]> {
    const where: Record<string, unknown> = { createdBy: userId };
    return this.appRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getVersionHistory(appId: string): Promise<ZeroCodeAppVersion[]> {
    return this.versionRepo.find({
      where: { appId },
      order: { createdAt: 'DESC' },
    });
  }

  async rollbackToVersion(
    appId: string,
    versionId: string,
    userId: string,
  ): Promise<AppSpec> {
    const version = await this.versionRepo.findOne({
      where: { id: versionId, appId },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) {
      throw new Error('App not found');
    }

    const currentVersion = await this.versionRepo.findOne({
      where: { appId },
      order: { createdAt: 'DESC' },
    });

    const versionParts = (currentVersion?.version || '0.0.0').split('.');
    const newVersion = `${versionParts[0]}.${parseInt(versionParts[1], 10) + 1}.0`;

    const rollbackVersion = this.versionRepo.create({
      appId,
      version: newVersion,
      definition: version.definition,
      changeSummary: `Rollback to version ${version.version}`,
      createdBy: userId,
    });
    await this.versionRepo.save(rollbackVersion);

    app.definition = version.definition;
    await this.appRepo.save(app);

    return version.definition as unknown as AppSpec;
  }

  async getAvailableComponents(): Promise<AppBuilderComponent[]> {
    return this.componentRepo.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async duplicateApp(
    appId: string,
    userId: string,
    newName: string,
  ): Promise<ZeroCodeApp> {
    const original = await this.appRepo.findOne({ where: { id: appId } });
    if (!original) {
      throw new Error('App not found');
    }

    const duplicate = this.appRepo.create({
      name: newName,
      description: original.description,
      version: '1.0.0',
      definition: original.definition,
      isPublished: false,
      createdBy: userId,
    });
    await this.appRepo.save(duplicate);

    const version = this.versionRepo.create({
      appId: duplicate.id,
      version: '1.0.0',
      definition: original.definition,
      changeSummary: `Duplicated from ${original.name}`,
      createdBy: userId,
    });
    await this.versionRepo.save(version);

    return duplicate;
  }

  async deleteApp(appId: string): Promise<void> {
    await this.versionRepo.delete({ appId });
    await this.appRepo.delete({ id: appId });
  }

  async exportApp(appId: string): Promise<{
    app: ZeroCodeApp;
    versions: ZeroCodeAppVersion[];
  }> {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) {
      throw new Error('App not found');
    }

    const versions = await this.versionRepo.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });

    return { app, versions };
  }
}
