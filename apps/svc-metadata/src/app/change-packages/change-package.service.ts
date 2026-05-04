import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import {
  Application,
  AutomationRule,
  ChangePackage,
  ChangePackageStatus,
  ChoiceList,
  CollectionDefinition,
  DecisionInput,
  DecisionRow,
  DecisionTable,
  FormDefinition,
  GuidedProcessActivity,
  GuidedProcessDefinition,
  GuidedProcessStage,
  MetadataChange,
  ProcessFlowDefinition,
  PropertyDefinition,
  PropertyType,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  WorkspaceDefinition,
  WorkspacePage,
} from '@hubblewave/instance-db';

export interface CreatePackageDto {
  applicationId: string;
  code: string;
  name: string;
  description?: string;
}

export interface AddArtifactDto {
  kind: MetadataChange['kind'];
  /**
   * Stable code of the artifact. Most kinds use a globally-unique code.
   * Collection-scoped kinds (form, automation) and standalone properties
   * use a composite code: `<collection_code>.<name>`.
   */
  code: string;
}

export interface ImportPackageDto {
  payload: {
    code: string;
    name: string;
    description?: string | null;
    applicationId: string;
    status: ChangePackageStatus;
    changes: MetadataChange[];
    sourceInstanceId?: string | null;
  };
  applicationId: string;
}

type CaptureResult = { after: Record<string, unknown>; source: string } | null;
type CaptureHandler = (manager: EntityManager, code: string) => Promise<CaptureResult>;
type ApplyHandler = (
  manager: EntityManager,
  change: MetadataChange,
  userId?: string,
) => Promise<void>;

/**
 * Plan §11.1 — Change Package CRUD + cross-instance capture/apply.
 *
 * Capture and apply are symmetric per kind. Every kind exposed in the
 * UI has both, plus the cross-instance ID-portability layer:
 *
 * 1. **Cascade**: parents that own children fully embed them in
 *    `after`. Collection → properties; View → revisions + variants;
 *    Decision → inputs + rows; GuidedProcess → stages + activities;
 *    Workspace → pages. Importing the parent recreates the children
 *    under the parent's target id.
 *
 * 2. **FK code resolution**: source-instance UUIDs are not portable
 *    across instances. At capture time we replace each FK id with
 *    the referent's stable code (`applicationId` → `applicationCode`,
 *    `propertyTypeId` → `propertyTypeCode`, `referenceCollectionId`
 *    → `referenceCollectionCode`, `choiceListId` → `choiceListCode`,
 *    `collectionId` → `collectionCode` for top-level rows). At apply
 *    time we resolve the codes against the target instance; an
 *    unresolvable code is a hard `NotFoundException`, which rolls
 *    back the whole import.
 *
 * 3. **Transactional apply**: `importPackage` runs inside a single
 *    `dataSource.transaction(...)`. The package row is persisted with
 *    `status='applied'` only after every change lands, so a partial
 *    apply leaves nothing committed.
 *
 * 4. **ADR-7 source guard**: a change cannot overwrite a target row
 *    whose `source` differs from the change's `source`. Mismatch is
 *    a `ConflictException` and rolls back the txn.
 */
@Injectable()
export class ChangePackageService {
  private readonly captureHandlers: Record<MetadataChange['kind'], CaptureHandler>;
  private readonly applyHandlers: Record<MetadataChange['kind'], ApplyHandler>;

  constructor(
    @InjectRepository(ChangePackage)
    private readonly packageRepo: Repository<ChangePackage>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.captureHandlers = {
      collection: (m, c) => this.captureCollection(m, c),
      property: (m, c) => this.captureProperty(m, c),
      view: (m, c) => this.captureView(m, c),
      form: (m, c) => this.captureForm(m, c),
      flow: (m, c) => this.captureFlow(m, c),
      automation: (m, c) => this.captureAutomation(m, c),
      decision: (m, c) => this.captureDecision(m, c),
      guidedProcess: (m, c) => this.captureGuidedProcess(m, c),
      workspace: (m, c) => this.captureWorkspace(m, c),
    };
    this.applyHandlers = {
      collection: (m, ch, u) => this.applyCollection(m, ch, u),
      property: (m, ch, u) => this.applyProperty(m, ch, u),
      view: (m, ch, u) => this.applyView(m, ch, u),
      form: (m, ch, u) => this.applyForm(m, ch, u),
      flow: (m, ch, u) => this.applyFlow(m, ch, u),
      automation: (m, ch, u) => this.applyAutomation(m, ch, u),
      decision: (m, ch, u) => this.applyDecision(m, ch, u),
      guidedProcess: (m, ch, u) => this.applyGuidedProcess(m, ch, u),
      workspace: (m, ch, u) => this.applyWorkspace(m, ch, u),
    };
  }

  // ─────────────────────────── CRUD ───────────────────────────────

  async list(
    applicationId?: string,
    status?: ChangePackageStatus,
  ): Promise<ChangePackage[]> {
    const qb = this.packageRepo
      .createQueryBuilder('cp')
      .orderBy('cp.updatedAt', 'DESC');
    if (applicationId) qb.andWhere('cp.application_id = :applicationId', { applicationId });
    if (status) qb.andWhere('cp.status = :status', { status });
    return qb.getMany();
  }

  async get(id: string): Promise<ChangePackage> {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException(`Change Package ${id} not found`);
    return pkg;
  }

  async create(dto: CreatePackageDto, userId?: string): Promise<ChangePackage> {
    if (!dto.code || !dto.name || !dto.applicationId) {
      throw new BadRequestException('code, name, applicationId are required');
    }
    const existing = await this.packageRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Change Package "${dto.code}" already exists`);
    }
    const pkg = this.packageRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      applicationId: dto.applicationId,
      status: 'open',
      changes: [],
      createdBy: userId,
      updatedBy: userId,
    });
    return this.packageRepo.save(pkg);
  }

  async addArtifact(
    id: string,
    dto: AddArtifactDto,
    userId?: string,
  ): Promise<ChangePackage> {
    const pkg = await this.get(id);
    if (pkg.status !== 'open') {
      throw new ConflictException(
        `Package "${pkg.code}" is ${pkg.status}; only open packages accept new artifacts.`,
      );
    }
    const change = await this.captureArtifact(this.dataSource.manager, dto);
    const next: MetadataChange[] = [
      ...pkg.changes.filter((c) => !(c.kind === change.kind && c.code === change.code)),
      change,
    ];
    await this.packageRepo.update(id, {
      changes: next as unknown as Record<string, unknown>[],
      updatedBy: userId,
    });
    return this.get(id);
  }

  async removeArtifact(
    id: string,
    kind: MetadataChange['kind'],
    code: string,
    userId?: string,
  ): Promise<ChangePackage> {
    const pkg = await this.get(id);
    if (pkg.status !== 'open') {
      throw new ConflictException(
        `Package "${pkg.code}" is ${pkg.status}; cannot modify a non-open package.`,
      );
    }
    const next = pkg.changes.filter((c) => !(c.kind === kind && c.code === code));
    await this.packageRepo.update(id, {
      changes: next as unknown as Record<string, unknown>[],
      updatedBy: userId,
    });
    return this.get(id);
  }

  async complete(id: string, sourceInstanceId: string, userId?: string): Promise<ChangePackage> {
    const pkg = await this.get(id);
    if (pkg.status === 'applied') {
      throw new ConflictException(`Package "${pkg.code}" is already applied`);
    }
    await this.packageRepo.update(id, {
      status: 'complete',
      completedAt: new Date(),
      sourceInstanceId,
      updatedBy: userId,
    });
    return this.get(id);
  }

  async exportJson(id: string): Promise<{
    code: string;
    name: string;
    description?: string | null;
    applicationId: string;
    /** Source-instance Application code, for the importer's target selector. */
    applicationCode: string | null;
    status: ChangePackageStatus;
    changes: MetadataChange[];
    sourceInstanceId?: string | null;
    completedAt?: Date | null;
    exportedAt: string;
  }> {
    const pkg = await this.get(id);
    const applicationCode = await this.codeOf(
      this.dataSource.manager,
      Application,
      pkg.applicationId,
    );
    return {
      code: pkg.code,
      name: pkg.name,
      description: pkg.description,
      applicationId: pkg.applicationId,
      applicationCode,
      status: pkg.status,
      changes: pkg.changes,
      sourceInstanceId: pkg.sourceInstanceId ?? null,
      completedAt: pkg.completedAt ?? null,
      exportedAt: new Date().toISOString(),
    };
  }

  async importPackage(dto: ImportPackageDto, userId?: string): Promise<ChangePackage> {
    if (!dto.payload?.code || !dto.payload?.changes) {
      throw new BadRequestException('payload.code and payload.changes are required');
    }
    if (!dto.applicationId) {
      throw new BadRequestException('applicationId is required');
    }
    const existing = await this.packageRepo.findOne({ where: { code: dto.payload.code } });
    if (existing) {
      throw new ConflictException(
        `A package with code "${dto.payload.code}" already exists in this instance`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      for (const change of dto.payload.changes) {
        const handler = this.applyHandlers[change.kind];
        if (!handler) {
          throw new BadRequestException(
            `No apply handler for artifact kind "${change.kind}" — package import aborted.`,
          );
        }
        await handler(manager, change, userId);
      }
      const pkgRepo = manager.getRepository(ChangePackage);
      const pkg = pkgRepo.create({
        code: dto.payload.code,
        name: dto.payload.name,
        description: dto.payload.description ?? null,
        applicationId: dto.applicationId,
        status: 'applied',
        changes: dto.payload.changes,
        sourceInstanceId: dto.payload.sourceInstanceId ?? null,
        appliedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      });
      return pkgRepo.save(pkg);
    });
  }

  // ─────────────────────────── Capture ────────────────────────────

  private async captureArtifact(
    manager: EntityManager,
    dto: AddArtifactDto,
  ): Promise<MetadataChange> {
    const handler = this.captureHandlers[dto.kind];
    if (!handler) {
      throw new BadRequestException(`Unsupported artifact kind: ${dto.kind}`);
    }
    const result = await handler(manager, dto.code);
    if (!result) {
      throw new NotFoundException(`${dto.kind} "${dto.code}" not found`);
    }
    return {
      kind: dto.kind,
      code: dto.code,
      beforeHash: this.hashPayload(result.after),
      after: result.after,
      source: result.source,
      capturedAt: new Date().toISOString(),
    };
  }

  private async captureCollection(manager: EntityManager, code: string): Promise<CaptureResult> {
    const collection = await manager.getRepository(CollectionDefinition).findOne({ where: { code } });
    if (!collection) return null;
    const properties = await manager
      .getRepository(PropertyDefinition)
      .find({ where: { collectionId: collection.id }, order: { position: 'ASC' } });
    const collectionPlain = await this.transformCollectionForExport(manager, this.toPlain(collection));
    const propertiesPlain = await Promise.all(
      properties.map((p) => this.transformPropertyForExport(manager, this.toPlain(p))),
    );
    return {
      after: { ...collectionPlain, properties: propertiesPlain },
      source: collection.source ?? 'custom',
    };
  }

  private async captureProperty(manager: EntityManager, code: string): Promise<CaptureResult> {
    if (!code.includes('.')) {
      throw new BadRequestException(
        `Property code must be qualified as "<collection_code>.<property_code>", got "${code}"`,
      );
    }
    const sep = code.indexOf('.');
    const collectionCode = code.slice(0, sep);
    const propertyCode = code.slice(sep + 1);
    const collection = await manager
      .getRepository(CollectionDefinition)
      .findOne({ where: { code: collectionCode } });
    if (!collection) return null;
    const property = await manager
      .getRepository(PropertyDefinition)
      .findOne({ where: { collectionId: collection.id, code: propertyCode } });
    if (!property) return null;
    const propertyPlain = await this.transformPropertyForExport(manager, this.toPlain(property));
    return {
      after: { ...propertyPlain, collectionCode },
      source: property.source ?? 'custom',
    };
  }

  private async captureView(manager: EntityManager, code: string): Promise<CaptureResult> {
    const view = await manager.getRepository(ViewDefinition).findOne({ where: { code } });
    if (!view) return null;
    const revisions = await manager
      .getRepository(ViewDefinitionRevision)
      .find({ where: { definitionId: view.id }, order: { revision: 'ASC' } });
    const variants = await manager
      .getRepository(ViewVariant)
      .find({ where: { definitionId: view.id }, order: { priority: 'DESC' } });
    const definitionPlain = this.toPlain(view) as Record<string, unknown> & { applicationId?: string | null };
    const applicationCode = await this.codeOf(manager, Application, definitionPlain.applicationId);
    delete definitionPlain.applicationId;
    return {
      after: {
        ...definitionPlain,
        applicationCode,
        revisions: revisions.map((r) => this.toPlain(r)),
        variants: variants.map((v) => this.toPlain(v)),
      },
      source: view.source ?? 'custom',
    };
  }

  private async captureForm(manager: EntityManager, code: string): Promise<CaptureResult> {
    return this.captureCollectionScopedNamed(manager, FormDefinition, code, 'form');
  }

  private async captureFlow(manager: EntityManager, code: string): Promise<CaptureResult> {
    const flow = await manager
      .getRepository(ProcessFlowDefinition)
      .findOne({ where: { code } });
    if (!flow) return null;
    const flowPlain = this.toPlain(flow) as Record<string, unknown> & {
      applicationId?: string | null;
      collectionId?: string | null;
    };
    const applicationCode = await this.codeOf(manager, Application, flowPlain.applicationId);
    const collectionCode = await this.codeOf(manager, CollectionDefinition, flowPlain.collectionId);
    delete flowPlain.applicationId;
    delete flowPlain.collectionId;
    return {
      after: { ...flowPlain, applicationCode, collectionCode },
      source: flow.source ?? 'custom',
    };
  }

  private async captureAutomation(manager: EntityManager, code: string): Promise<CaptureResult> {
    return this.captureCollectionScopedNamed(manager, AutomationRule, code, 'automation');
  }

  private async captureDecision(manager: EntityManager, code: string): Promise<CaptureResult> {
    const dec = await manager.getRepository(DecisionTable).findOne({ where: { code } });
    if (!dec) return null;
    const inputs = await manager
      .getRepository(DecisionInput)
      .find({ where: { tableId: dec.id }, order: { position: 'ASC' } });
    const rows = await manager
      .getRepository(DecisionRow)
      .find({ where: { tableId: dec.id }, order: { position: 'ASC' } });
    const inputIdToPosition = new Map<string, number>(inputs.map((i) => [i.id, i.position]));
    const decPlain = this.toPlain(dec) as Record<string, unknown> & {
      applicationId?: string | null;
      collectionId?: string | null;
    };
    const applicationCode = await this.codeOf(manager, Application, decPlain.applicationId);
    const collectionCode = await this.codeOf(manager, CollectionDefinition, decPlain.collectionId);
    delete decPlain.applicationId;
    delete decPlain.collectionId;
    return {
      after: {
        ...decPlain,
        applicationCode,
        collectionCode,
        inputs: inputs.map((i) => this.toPlain(i)),
        rows: rows.map((r) => {
          const plain = this.toPlain(r);
          const conditions = Array.isArray(plain.conditions) ? plain.conditions : [];
          // Rewrite conditions[].inputId from a source-instance UUID to
          // the input's stable position number, so the apply step can
          // re-resolve to the target instance's freshly-generated input id.
          plain.conditions = conditions.map((c) => {
            const cond = c as { inputId?: string; [k: string]: unknown };
            const { inputId, ...rest } = cond;
            return {
              ...rest,
              inputPosition:
                typeof inputId === 'string' ? (inputIdToPosition.get(inputId) ?? null) : null,
            };
          });
          return plain;
        }),
      },
      source: dec.source ?? 'custom',
    };
  }

  private async captureGuidedProcess(manager: EntityManager, code: string): Promise<CaptureResult> {
    const gp = await manager
      .getRepository(GuidedProcessDefinition)
      .findOne({ where: { code } });
    if (!gp) return null;
    const stages = await manager
      .getRepository(GuidedProcessStage)
      .find({ where: { processId: gp.id }, order: { position: 'ASC' } });
    const stagesPlain = await Promise.all(
      stages.map(async (s) => {
        const activities = await manager
          .getRepository(GuidedProcessActivity)
          .find({ where: { stageId: s.id }, order: { position: 'ASC' } });
        return {
          ...this.toPlain(s),
          activities: activities.map((a) => this.toPlain(a)),
        };
      }),
    );
    const gpPlain = this.toPlain(gp) as Record<string, unknown> & {
      applicationId?: string | null;
      collectionId?: string | null;
    };
    const applicationCode = await this.codeOf(manager, Application, gpPlain.applicationId);
    const collectionCode = await this.codeOf(manager, CollectionDefinition, gpPlain.collectionId);
    delete gpPlain.applicationId;
    delete gpPlain.collectionId;
    return {
      after: { ...gpPlain, applicationCode, collectionCode, stages: stagesPlain },
      source: gp.source ?? 'custom',
    };
  }

  private async captureWorkspace(manager: EntityManager, code: string): Promise<CaptureResult> {
    const ws = await manager.getRepository(WorkspaceDefinition).findOne({ where: { code } });
    if (!ws) return null;
    const pages = await manager
      .getRepository(WorkspacePage)
      .find({ where: { workspaceId: ws.id }, order: { position: 'ASC' } });
    const wsPlain = this.toPlain(ws) as Record<string, unknown> & { applicationId?: string | null };
    const applicationCode = await this.codeOf(manager, Application, wsPlain.applicationId);
    delete wsPlain.applicationId;
    // Pages may reference a per-page collection (list / record / search
    // page kinds). Replace the source-instance UUID with the stable
    // collection code so apply can re-resolve to the target instance.
    const pagesPlain = await Promise.all(
      pages.map(async (p) => {
        const plain = this.toPlain(p) as Record<string, unknown> & {
          collectionId?: string | null;
        };
        const collectionCode = await this.codeOf(manager, CollectionDefinition, plain.collectionId);
        delete plain.collectionId;
        return { ...plain, collectionCode };
      }),
    );
    return {
      after: {
        ...wsPlain,
        applicationCode,
        pages: pagesPlain,
      },
      source: ws.source ?? 'custom',
    };
  }

  private async captureCollectionScopedNamed(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    code: string,
    label: string,
  ): Promise<CaptureResult> {
    if (!code.includes('.')) {
      throw new BadRequestException(
        `${label} code must be qualified as "<collection_code>.<name>", got "${code}"`,
      );
    }
    const sep = code.indexOf('.');
    const collectionCode = code.slice(0, sep);
    const itemName = code.slice(sep + 1);
    const collection = await manager
      .getRepository(CollectionDefinition)
      .findOne({ where: { code: collectionCode } });
    if (!collection) return null;
    const row = await manager
      .getRepository(entity)
      .findOne({ where: { collectionId: collection.id, name: itemName } as ObjectLiteral });
    if (!row) return null;
    const plain = this.toPlain(row) as Record<string, unknown> & { applicationId?: string | null };
    const applicationCode = await this.codeOf(manager, Application, plain.applicationId);
    delete plain.applicationId;
    delete (plain as { collectionId?: unknown }).collectionId;
    return {
      after: { ...plain, collectionCode, applicationCode },
      source: (row as { source?: string }).source ?? 'custom',
    };
  }

  // ───────── Capture-side FK transforms ─────────

  private async transformCollectionForExport(
    manager: EntityManager,
    plain: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const out = { ...plain };
    const applicationCode = await this.codeOf(manager, Application, out.applicationId);
    delete out.applicationId;
    return { ...out, applicationCode };
  }

  private async transformPropertyForExport(
    manager: EntityManager,
    plain: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const out = { ...plain };
    const applicationCode = await this.codeOf(manager, Application, out.applicationId);
    const propertyTypeCode = await this.codeOf(manager, PropertyType, out.propertyTypeId);
    const referenceCollectionCode = await this.codeOf(
      manager,
      CollectionDefinition,
      out.referenceCollectionId,
    );
    const choiceListCode = await this.codeOf(manager, ChoiceList, out.choiceListId);
    delete out.applicationId;
    delete out.propertyTypeId;
    delete out.referenceCollectionId;
    delete out.choiceListId;
    delete out.collectionId;
    return {
      ...out,
      applicationCode,
      propertyTypeCode,
      referenceCollectionCode,
      choiceListCode,
    };
  }

  private async codeOf(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    id: unknown,
  ): Promise<string | null> {
    if (typeof id !== 'string' || id.length === 0) return null;
    const row = await manager.getRepository(entity).findOne({ where: { id } as ObjectLiteral });
    if (!row) return null;
    const code = (row as { code?: string }).code;
    return typeof code === 'string' ? code : null;
  }

  // ─────────────────────────── Apply ──────────────────────────────

  private async applyCollection(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(CollectionDefinition);
    const propRepo = manager.getRepository(PropertyDefinition);
    const incoming = change.after as Record<string, unknown> & {
      code?: string;
      properties?: Record<string, unknown>[];
    };
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);

    const incomingProps = Array.isArray(incoming.properties) ? incoming.properties : [];
    const baseFields = await this.resolveCollectionForImport(manager, incoming, ['properties']);
    const target = existing ?? repo.create();
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    const saved = await repo.save(target);

    for (const propPlain of incomingProps) {
      await this.applyPropertyOnto(manager, propRepo, saved.id, propPlain, change.source, userId);
    }
  }

  private async applyProperty(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const incoming = change.after as Record<string, unknown> & {
      code?: string;
      collectionCode?: string;
    };
    const collectionCode =
      typeof incoming.collectionCode === 'string'
        ? incoming.collectionCode
        : change.code.includes('.')
          ? change.code.split('.', 1)[0]
          : undefined;
    if (!collectionCode) {
      throw new BadRequestException(
        `Property change "${change.code}" is missing collectionCode`,
      );
    }
    const propertyCode =
      change.code.includes('.') ? change.code.slice(change.code.indexOf('.') + 1) : change.code;
    const collection = await manager
      .getRepository(CollectionDefinition)
      .findOne({ where: { code: collectionCode } });
    if (!collection) {
      throw new NotFoundException(
        `Cannot apply property "${propertyCode}": parent collection "${collectionCode}" not found on target instance`,
      );
    }
    const propRepo = manager.getRepository(PropertyDefinition);
    await this.applyPropertyOnto(
      manager,
      propRepo,
      collection.id,
      { ...incoming, code: propertyCode },
      change.source,
      userId,
    );
  }

  private async applyPropertyOnto(
    manager: EntityManager,
    propRepo: Repository<PropertyDefinition>,
    collectionId: string,
    incoming: Record<string, unknown>,
    source: string,
    userId?: string,
  ): Promise<void> {
    const code = typeof incoming.code === 'string' ? incoming.code : null;
    if (!code) {
      throw new BadRequestException('Property snapshot is missing code');
    }
    const existing = await propRepo.findOne({ where: { collectionId, code } });
    this.assertCanOverwrite(existing, source, 'property', code);
    const baseFields = await this.resolvePropertyForImport(manager, incoming);
    const target = existing ?? propRepo.create();
    Object.assign(target, baseFields);
    target.code = code;
    target.collectionId = collectionId;
    target.source = source;
    if (!existing) target.createdBy = userId;
    await propRepo.save(target);
  }

  private async applyView(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(ViewDefinition);
    const revRepo = manager.getRepository(ViewDefinitionRevision);
    const variantRepo = manager.getRepository(ViewVariant);
    const incoming = change.after as Record<string, unknown> & {
      revisions?: Record<string, unknown>[];
      variants?: Record<string, unknown>[];
    };
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);

    const baseFields = await this.resolveViewForImport(manager, incoming);
    const target = existing ?? repo.create();
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    const saved = await repo.save(target);

    // Revisions: upsert by (definitionId, revision number). Without
    // these the runtime resolver returns no published layout. The
    // source instance's `publishedBy` / `publishedAt` are dropped —
    // those user FKs don't exist on the target. The importing user
    // owns the publish stamp (if the snapshot was already published).
    for (const revPlain of incoming.revisions ?? []) {
      const rev = revPlain as Record<string, unknown> & { revision?: number; status?: string };
      if (typeof rev.revision !== 'number') continue;
      const existingRev = await revRepo.findOne({
        where: { definitionId: saved.id, revision: rev.revision },
      });
      const revFields = this.stripVolatile(rev, [
        'definitionId',
        'publishedBy',
        'publishedAt',
      ]);
      const targetRev = existingRev ?? revRepo.create();
      Object.assign(targetRev, revFields);
      targetRev.definitionId = saved.id;
      if (!existingRev) targetRev.createdBy = userId;
      if (rev.status === 'published') {
        targetRev.publishedBy = userId ?? null;
        targetRev.publishedAt = new Date();
      }
      await revRepo.save(targetRev);
    }

    // Variants: append from the package. Variants don't have a
    // unique cross-instance key (no `code`), so a target-side variant
    // with matching (scope, scopeKey, priority) is treated as the
    // "same variant" and gets updated; otherwise a fresh row inserts.
    for (const varPlain of incoming.variants ?? []) {
      const v = varPlain as Record<string, unknown> & {
        scope?: string;
        scopeKey?: string | null;
        priority?: number;
      };
      const existingVariant = await variantRepo.findOne({
        where: {
          definitionId: saved.id,
          scope: v.scope as never,
          scopeKey: (v.scopeKey ?? null) as never,
          priority: v.priority as never,
        },
      });
      const varFields = this.stripVolatile(v, ['definitionId']);
      const targetVar = existingVariant ?? variantRepo.create();
      Object.assign(targetVar, varFields);
      targetVar.definitionId = saved.id;
      if (!existingVariant) targetVar.createdBy = userId;
      await variantRepo.save(targetVar);
    }
  }

  private async applyForm(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    await this.applyCollectionScopedNamed(manager, FormDefinition, change, userId);
  }

  private async applyFlow(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(ProcessFlowDefinition);
    const incoming = change.after as Record<string, unknown>;
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);
    const baseFields = await this.resolveTopLevelFks(manager, incoming, ['code']);
    const target = (existing ?? repo.create()) as ProcessFlowDefinition;
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    await repo.save(target);
  }

  private async applyAutomation(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    await this.applyCollectionScopedNamed(manager, AutomationRule, change, userId);
  }

  private async applyDecision(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(DecisionTable);
    const inputRepo = manager.getRepository(DecisionInput);
    const rowRepo = manager.getRepository(DecisionRow);
    const incoming = change.after as Record<string, unknown> & {
      inputs?: Array<Record<string, unknown> & { position?: number }>;
      rows?: Array<Record<string, unknown> & {
        conditions?: Array<{ inputPosition?: number | null; [k: string]: unknown }>;
      }>;
    };
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);
    const baseFields = await this.resolveTopLevelFks(manager, incoming, [
      'inputs',
      'rows',
      'code',
    ]);
    const target = (existing ?? repo.create()) as DecisionTable;
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    const saved = await repo.save(target);

    // Replace children: decision tables are owned by their inputs and
    // rows; cross-instance imports rebuild from the package snapshot.
    await inputRepo.delete({ tableId: saved.id });
    await rowRepo.delete({ tableId: saved.id });

    const positionToInputId = new Map<number, string>();
    for (const inputPlain of incoming.inputs ?? []) {
      const fields = this.stripVolatile(inputPlain, ['tableId']);
      const inputRow = inputRepo.create();
      Object.assign(inputRow, fields);
      inputRow.tableId = saved.id;
      const insertedInput = await inputRepo.save(inputRow);
      if (typeof insertedInput.position === 'number') {
        positionToInputId.set(insertedInput.position, insertedInput.id);
      }
    }

    for (const rowPlain of incoming.rows ?? []) {
      const fields = this.stripVolatile(rowPlain, ['tableId', 'conditions']);
      const conditions = (rowPlain.conditions ?? []).map((c) => {
        const inputPosition = c.inputPosition ?? null;
        if (inputPosition === null || !positionToInputId.has(inputPosition)) {
          throw new BadRequestException(
            `Decision row references unknown input at position ${inputPosition} for table "${change.code}"`,
          );
        }
        const { inputPosition: _drop, ...rest } = c;
        void _drop;
        return { ...rest, inputId: positionToInputId.get(inputPosition) };
      });
      const rowEntity = rowRepo.create();
      Object.assign(rowEntity, fields);
      rowEntity.tableId = saved.id;
      rowEntity.conditions = conditions as DecisionRow['conditions'];
      await rowRepo.save(rowEntity);
    }
  }

  private async applyGuidedProcess(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(GuidedProcessDefinition);
    const stageRepo = manager.getRepository(GuidedProcessStage);
    const activityRepo = manager.getRepository(GuidedProcessActivity);
    const incoming = change.after as Record<string, unknown> & {
      stages?: Array<Record<string, unknown> & {
        activities?: Record<string, unknown>[];
      }>;
    };
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);
    const baseFields = await this.resolveTopLevelFks(manager, incoming, ['stages', 'code']);
    const target = (existing ?? repo.create()) as GuidedProcessDefinition;
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    const saved = await repo.save(target);

    // Replace stages + activities (children are owned by the parent).
    const existingStages = await stageRepo.find({ where: { processId: saved.id } });
    if (existingStages.length > 0) {
      await activityRepo.delete({ stageId: existingStages.map((s) => s.id) as never });
      await stageRepo.delete({ processId: saved.id });
    }

    for (const stagePlain of incoming.stages ?? []) {
      const stageFields = this.stripVolatile(stagePlain, ['processId', 'activities']);
      const stage = stageRepo.create();
      Object.assign(stage, stageFields);
      stage.processId = saved.id;
      const savedStage = await stageRepo.save(stage);
      for (const activityPlain of stagePlain.activities ?? []) {
        const activityFields = this.stripVolatile(activityPlain, ['stageId']);
        const activity = activityRepo.create();
        Object.assign(activity, activityFields);
        activity.stageId = savedStage.id;
        await activityRepo.save(activity);
      }
    }
  }

  private async applyWorkspace(
    manager: EntityManager,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(WorkspaceDefinition);
    const pageRepo = manager.getRepository(WorkspacePage);
    const incoming = change.after as Record<string, unknown> & {
      code?: string;
      pages?: Record<string, unknown>[];
    };
    const existing = await repo.findOne({ where: { code: change.code } });
    this.assertCanOverwrite(existing, change.source, change.kind, change.code);

    const incomingPages = Array.isArray(incoming.pages) ? incoming.pages : [];
    const baseFields = await this.resolveTopLevelFks(manager, incoming, ['pages', 'code']);
    const target = existing ?? repo.create();
    Object.assign(target, baseFields);
    target.code = change.code;
    target.source = change.source;
    target.updatedBy = userId;
    if (!existing) target.createdBy = userId;
    const saved = await repo.save(target);

    for (const pagePlain of incomingPages) {
      const page = pagePlain as Record<string, unknown> & {
        code?: string;
        collectionCode?: string | null;
      };
      const pageCode = typeof page.code === 'string' ? page.code : null;
      if (!pageCode) continue;
      const existingPage = await pageRepo.findOne({
        where: { workspaceId: saved.id, code: pageCode },
      });
      const pageBase = this.stripVolatile(page, ['workspaceId', 'collectionCode']);
      // Resolve the page's optional collectionCode against the target
      // instance. Unknown collectionCode is a hard error rather than a
      // silent FK violation at save time.
      const pageCollectionId = await this.resolveCodeOptional(
        manager,
        CollectionDefinition,
        page.collectionCode,
        'workspace page collection',
      );
      const pageTarget = existingPage ?? pageRepo.create();
      Object.assign(pageTarget, pageBase);
      pageTarget.code = pageCode;
      pageTarget.workspaceId = saved.id;
      (pageTarget as unknown as { collectionId?: string | null }).collectionId =
        pageCollectionId ?? null;
      await pageRepo.save(pageTarget);
    }
  }

  private async applyCollectionScopedNamed(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    change: MetadataChange,
    userId?: string,
  ): Promise<void> {
    const incoming = change.after as Record<string, unknown> & {
      collectionCode?: string;
      name?: string;
    };
    const collectionCode =
      typeof incoming.collectionCode === 'string'
        ? incoming.collectionCode
        : change.code.includes('.')
          ? change.code.slice(0, change.code.indexOf('.'))
          : undefined;
    if (!collectionCode) {
      throw new BadRequestException(
        `${change.kind} change "${change.code}" is missing collectionCode`,
      );
    }
    const itemName =
      change.code.includes('.')
        ? change.code.slice(change.code.indexOf('.') + 1)
        : (typeof incoming.name === 'string' ? incoming.name : null);
    if (!itemName) {
      throw new BadRequestException(
        `${change.kind} change "${change.code}" is missing name`,
      );
    }
    const collection = await manager
      .getRepository(CollectionDefinition)
      .findOne({ where: { code: collectionCode } });
    if (!collection) {
      throw new NotFoundException(
        `Cannot apply ${change.kind} "${itemName}": parent collection "${collectionCode}" not found on target instance`,
      );
    }
    const repo = manager.getRepository(entity);
    const existing = await repo.findOne({
      where: { collectionId: collection.id, name: itemName } as ObjectLiteral,
    });
    this.assertCanOverwrite(
      existing as { source?: string | null } | null,
      change.source,
      change.kind,
      change.code,
    );
    const fields = await this.resolveTopLevelFks(manager, incoming, ['collectionCode']);
    const target = (existing ?? repo.create()) as Record<string, unknown>;
    Object.assign(target, fields);
    target.collectionId = collection.id;
    target.name = itemName;
    target.source = change.source;
    if (!existing) target.createdBy = userId;
    target.updatedBy = userId;
    await repo.save(target);
  }

  // ───────── Apply-side FK resolvers ─────────

  /**
   * Resolve a flat top-level snapshot's stable codes back into target
   * UUIDs. Handles applicationCode → applicationId and
   * collectionCode → collectionId (the two kinds of cross-instance FK
   * a top-level metadata row can carry). Any extra keys to drop are
   * passed in `extras`; volatile fields (id, timestamps, audit) are
   * always stripped.
   */
  private async resolveTopLevelFks(
    manager: EntityManager,
    incoming: Record<string, unknown>,
    extras: ReadonlyArray<string>,
  ): Promise<Record<string, unknown>> {
    const stripped = this.stripVolatile(incoming, [
      'applicationCode',
      'collectionCode',
      ...extras,
    ]);
    const applicationId = await this.resolveCodeRequired(
      manager,
      Application,
      incoming.applicationCode,
      'application',
      'applicationCode',
    );
    const collectionId = await this.resolveCodeOptional(
      manager,
      CollectionDefinition,
      incoming.collectionCode,
      'collection',
    );
    const out: Record<string, unknown> = { ...stripped };
    if (applicationId !== undefined) out.applicationId = applicationId;
    if (collectionId !== undefined) out.collectionId = collectionId;
    return out;
  }

  private async resolveCollectionForImport(
    manager: EntityManager,
    incoming: Record<string, unknown>,
    extras: ReadonlyArray<string>,
  ): Promise<Record<string, unknown>> {
    const stripped = this.stripVolatile(incoming, ['applicationCode', ...extras]);
    const applicationId = await this.resolveCodeRequired(
      manager,
      Application,
      incoming.applicationCode,
      'application',
      'applicationCode',
    );
    const out: Record<string, unknown> = { ...stripped };
    if (applicationId !== undefined) out.applicationId = applicationId;
    return out;
  }

  private async resolveViewForImport(
    manager: EntityManager,
    incoming: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const stripped = this.stripVolatile(incoming, [
      'applicationCode',
      'revisions',
      'variants',
    ]);
    const applicationId = await this.resolveCodeRequired(
      manager,
      Application,
      incoming.applicationCode,
      'application',
      'applicationCode',
    );
    const out: Record<string, unknown> = { ...stripped };
    if (applicationId !== undefined) out.applicationId = applicationId;
    return out;
  }

  private async resolvePropertyForImport(
    manager: EntityManager,
    incoming: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const stripped = this.stripVolatile(incoming, [
      'applicationCode',
      'propertyTypeCode',
      'referenceCollectionCode',
      'choiceListCode',
      'collectionCode',
    ]);
    const applicationId = await this.resolveCodeRequired(
      manager,
      Application,
      incoming.applicationCode,
      'application',
      'applicationCode',
    );
    const propertyTypeId = await this.resolveCodeRequired(
      manager,
      PropertyType,
      incoming.propertyTypeCode,
      'property type',
      'propertyTypeCode',
    );
    const referenceCollectionId = await this.resolveCodeOptional(
      manager,
      CollectionDefinition,
      incoming.referenceCollectionCode,
      'reference collection',
    );
    const choiceListId = await this.resolveCodeOptional(
      manager,
      ChoiceList,
      incoming.choiceListCode,
      'choice list',
    );
    const out: Record<string, unknown> = { ...stripped };
    if (applicationId !== undefined) out.applicationId = applicationId;
    if (propertyTypeId !== undefined) out.propertyTypeId = propertyTypeId;
    out.referenceCollectionId = referenceCollectionId ?? null;
    out.choiceListId = choiceListId ?? null;
    return out;
  }

  /**
   * Resolve a stable code to a target UUID. `null`/`undefined` code
   * returns undefined (caller will skip setting the FK). A non-null
   * code that doesn't resolve is a hard NotFoundException — silently
   * setting null would corrupt the target row.
   */
  private async resolveCodeRequired(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    code: unknown,
    label: string,
    field: string,
  ): Promise<string | null | undefined> {
    if (code === null) return null;
    if (code === undefined) return undefined;
    if (typeof code !== 'string' || code.length === 0) {
      throw new BadRequestException(`Invalid ${label} ${field}: "${String(code)}"`);
    }
    const row = await manager
      .getRepository(entity)
      .findOne({ where: { code } as ObjectLiteral });
    if (!row) {
      throw new NotFoundException(
        `${label} "${code}" not found on target instance — cannot resolve ${field}`,
      );
    }
    return (row as { id: string }).id;
  }

  private async resolveCodeOptional(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    code: unknown,
    label: string,
  ): Promise<string | null | undefined> {
    if (code === null) return null;
    if (code === undefined) return undefined;
    if (typeof code !== 'string' || code.length === 0) return null;
    const row = await manager
      .getRepository(entity)
      .findOne({ where: { code } as ObjectLiteral });
    if (!row) {
      throw new NotFoundException(
        `${label} "${code}" not found on target instance — referenced FK cannot be resolved`,
      );
    }
    return (row as { id: string }).id;
  }

  // ─────────────────────────── Shared ─────────────────────────────

  private assertCanOverwrite(
    target: { source?: string | null } | null,
    incomingSource: string,
    kind: string,
    code: string,
  ): void {
    if (!target) return;
    const targetSource = target.source && target.source.length > 0 ? target.source : 'custom';
    if (targetSource !== incomingSource) {
      throw new ConflictException(
        `${kind} "${code}" exists with source="${targetSource}" on the target instance; the package change is owned by "${incomingSource}". Resolve via a variant override or skip this artifact.`,
      );
    }
  }

  private stripVolatile(
    snapshot: Record<string, unknown>,
    extras: ReadonlyArray<string>,
  ): Record<string, unknown> {
    const skip = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
      ...extras,
    ]);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(snapshot)) {
      if (skip.has(k)) continue;
      result[k] = v;
    }
    return result;
  }

  private toPlain(row: object): Record<string, unknown> {
    return JSON.parse(JSON.stringify(row));
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const text = this.canonicalStringify(payload);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `fnv:${hash.toString(16)}`;
  }

  private canonicalStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((v) => this.canonicalStringify(v)).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${this.canonicalStringify(v)}`).join(',')}}`;
  }
}
