import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  DecisionInput,
  DecisionInputType,
  DecisionRow,
  DecisionRowCondition,
  DecisionRowOperator,
  DecisionTable,
} from '@hubblewave/instance-db';
import { evaluateDecisionTable, type DecisionTableDto } from '@hubblewave/shared-types';

export interface CreateDecisionTableDto {
  code: string;
  name: string;
  description?: string;
  answerCollectionCode?: string;
  hitPolicy?: 'first_match' | 'all_matches';
  inputs: Array<{
    name: string;
    inputType: DecisionInputType;
    config?: Record<string, unknown>;
    defaultValue?: unknown;
    position?: number;
  }>;
}

export interface UpdateDecisionTableDto {
  name?: string;
  description?: string;
  answerCollectionCode?: string | null;
  hitPolicy?: 'first_match' | 'all_matches';
  isActive?: boolean;
}

export interface UpsertRowDto {
  position: number;
  conditions: DecisionRowCondition[];
  answerRecordId?: string | null;
  answerLiteral?: unknown;
  description?: string;
  isActive?: boolean;
}

export interface EvaluateInput {
  /** Map of inputName → value supplied by the caller. */
  inputs: Record<string, unknown>;
}

export interface EvaluateResult {
  matched: boolean;
  rowId?: string;
  rowPosition?: number;
  answer?: unknown;
  /** Set when hitPolicy=all_matches; one entry per matched row. */
  matches?: Array<{ rowId: string; rowPosition: number; answer: unknown }>;
}

const VALID_OPERATORS: ReadonlySet<DecisionRowOperator> = new Set([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'greater_than',
  'greater_than_or_equals',
  'less_than',
  'less_than_or_equals',
  'is_null',
  'is_not_null',
]);

const VALID_INPUT_TYPES: ReadonlySet<DecisionInputType> = new Set([
  'string',
  'integer',
  'boolean',
  'choice',
  'reference',
  'date',
]);

@Injectable()
export class DecisionTableService {
  constructor(
    @InjectRepository(DecisionTable)
    private readonly tableRepo: Repository<DecisionTable>,
    @InjectRepository(DecisionInput)
    private readonly _inputRepo: Repository<DecisionInput>,
    @InjectRepository(DecisionRow)
    private readonly rowRepo: Repository<DecisionRow>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly dataSource: DataSource,
  ) {
    void this._inputRepo;
  }

  async list(collectionId: string, includeInactive = false): Promise<DecisionTable[]> {
    const qb = this.tableRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.inputs', 'inputs')
      .where('t.collectionId = :collectionId', { collectionId })
      .orderBy('t.name', 'ASC');
    if (!includeInactive) {
      qb.andWhere('t.is_active = true');
    }
    return qb.getMany();
  }

  async get(id: string): Promise<DecisionTable> {
    const table = await this.tableRepo.findOne({
      where: { id },
      relations: ['inputs', 'rows'],
    });
    if (!table) throw new NotFoundException(`Decision Table ${id} not found`);
    return table;
  }

  async getByCode(code: string): Promise<DecisionTable> {
    const table = await this.tableRepo.findOne({
      where: { code },
      relations: ['inputs', 'rows'],
    });
    if (!table) throw new NotFoundException(`Decision Table ${code} not found`);
    return table;
  }

  async create(
    collectionId: string,
    dto: CreateDecisionTableDto,
    userId?: string,
  ): Promise<DecisionTable> {
    if (!dto.code) throw new BadRequestException('code is required');
    if (!dto.name) throw new BadRequestException('name is required');
    this.assertValidInputs(dto.inputs);

    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });
    if (!collection) throw new NotFoundException(`Collection ${collectionId} not found`);
    if (!collection.applicationId) {
      throw new BadRequestException(
        `Collection ${collectionId} has no applicationId; ADR-6 requires every metadata entity scoped to an Application.`,
      );
    }
    const applicationId = collection.applicationId;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      const table = queryRunner.manager.create(DecisionTable, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        collectionId,
        applicationId,
        answerCollectionCode: dto.answerCollectionCode ?? null,
        hitPolicy: dto.hitPolicy ?? 'first_match',
        status: 'draft',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      });
      const saved = await queryRunner.manager.save(DecisionTable, table);

      const inputs = dto.inputs.map((input, index) =>
        queryRunner.manager.create(DecisionInput, {
          tableId: saved.id,
          name: input.name,
          inputType: input.inputType,
          config: input.config ?? null,
          defaultValue: input.defaultValue ?? null,
          position: input.position ?? index,
        }),
      );
      await queryRunner.manager.save(DecisionInput, inputs);

      await queryRunner.commitTransaction();
      return this.get(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    dto: UpdateDecisionTableDto,
    userId?: string,
  ): Promise<DecisionTable> {
    await this.get(id);
    const updateData: Record<string, unknown> = { updatedBy: userId, status: 'draft' };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.answerCollectionCode !== undefined)
      updateData.answerCollectionCode = dto.answerCollectionCode;
    if (dto.hitPolicy !== undefined) updateData.hitPolicy = dto.hitPolicy;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    await this.tableRepo.update(id, updateData);
    return this.get(id);
  }

  async publish(id: string, userId?: string): Promise<DecisionTable> {
    const table = await this.get(id);
    table.status = 'published';
    table.publishedAt = new Date();
    table.updatedBy = userId;
    await this.tableRepo.save(table);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.tableRepo.update(id, { isActive: false, status: 'deprecated' });
  }

  async upsertRow(
    tableId: string,
    rowId: string | null,
    dto: UpsertRowDto,
  ): Promise<DecisionRow> {
    const table = await this.get(tableId);
    this.assertConditionsValid(dto.conditions, table.inputs ?? []);

    let saved: DecisionRow;
    if (rowId) {
      const row = await this.rowRepo.findOne({ where: { id: rowId } });
      if (!row || row.tableId !== tableId) {
        throw new NotFoundException(`Decision Row ${rowId} not found in table ${tableId}`);
      }
      row.position = dto.position;
      row.conditions = dto.conditions;
      row.answerRecordId = dto.answerRecordId ?? null;
      row.answerLiteral = dto.answerLiteral ?? null;
      row.description = dto.description ?? null;
      if (dto.isActive !== undefined) row.isActive = dto.isActive;
      saved = await this.rowRepo.save(row);
    } else {
      const created = this.rowRepo.create({
        tableId,
        position: dto.position,
        conditions: dto.conditions,
        answerRecordId: dto.answerRecordId ?? null,
        answerLiteral: dto.answerLiteral ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      });
      saved = await this.rowRepo.save(created);
    }

    // Row edits invalidate the published revision: callers (Flow Actions,
    // AVA prompts) must re-publish before the change goes live, so they
    // never observe an unreviewed row diff against the published table.
    if (table.status === 'published') {
      await this.tableRepo.update(tableId, { status: 'draft' });
    }
    return saved;
  }

  async deleteRow(tableId: string, rowId: string): Promise<void> {
    const table = await this.get(tableId);
    const row = await this.rowRepo.findOne({ where: { id: rowId } });
    if (!row || row.tableId !== tableId) {
      throw new NotFoundException(`Decision Row ${rowId} not found in table ${tableId}`);
    }
    await this.rowRepo.delete(rowId);
    if (table.status === 'published') {
      await this.tableRepo.update(tableId, { status: 'draft' });
    }
  }

  /**
   * Evaluate inputs against the table's rows. Hit policy `first_match`
   * returns the first matching row's answer; `all_matches` returns
   * every match. Each row's conditions are AND'ed together. Inputs
   * not declared on the table are ignored; missing required inputs
   * fall back to the input's defaultValue, then null.
   */
  async evaluate(tableIdOrCode: string, input: EvaluateInput): Promise<EvaluateResult> {
    const table = await this.resolveTable(tableIdOrCode);
    if (table.status !== 'published') {
      throw new BadRequestException(
        `Decision Table ${table.code} is not published — only published tables can be evaluated`,
      );
    }
    return evaluateDecisionTable(this.toDto(table), input.inputs);
  }

  /**
   * Editor-only evaluation that skips the published-status gate.
   * Authors need this to test draft tables (every row/metadata edit
   * flips a published table back to draft, so without this the
   * normal author-test loop is broken). The controller route is
   * gated by `metadata:flow:manage`, so this is *not* available to
   * runtime callers — the runtime path stays `evaluate` which
   * still enforces published.
   */
  async evaluateDraft(tableIdOrCode: string, input: EvaluateInput): Promise<EvaluateResult> {
    const table = await this.resolveTable(tableIdOrCode);
    return evaluateDecisionTable(this.toDto(table), input.inputs);
  }

  toDto(table: DecisionTable): DecisionTableDto {
    return {
      id: table.id,
      code: table.code,
      name: table.name,
      description: table.description,
      collectionId: table.collectionId,
      status: table.status,
      hitPolicy: table.hitPolicy,
      answerCollectionCode: table.answerCollectionCode ?? null,
      inputs: (table.inputs ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        defaultValue: i.defaultValue,
      })),
      rows: (table.rows ?? []).map((r) => ({
        id: r.id,
        position: r.position,
        isActive: r.isActive,
        conditions: r.conditions ?? [],
        answerLiteral: r.answerLiteral,
        answerRecordId: r.answerRecordId ?? null,
      })),
    };
  }

  private async resolveTable(tableIdOrCode: string): Promise<DecisionTable> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tableIdOrCode,
    );
    return isUuid ? this.get(tableIdOrCode) : this.getByCode(tableIdOrCode);
  }

  private assertValidInputs(inputs: CreateDecisionTableDto['inputs']): void {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new BadRequestException('At least one input is required');
    }
    const seenNames = new Set<string>();
    for (const input of inputs) {
      if (!input.name) throw new BadRequestException('Each input requires a name');
      if (seenNames.has(input.name)) {
        throw new BadRequestException(`Duplicate input name: ${input.name}`);
      }
      seenNames.add(input.name);
      if (!VALID_INPUT_TYPES.has(input.inputType)) {
        throw new BadRequestException(`Unknown input type: ${input.inputType}`);
      }
    }
  }

  private assertConditionsValid(
    conditions: DecisionRowCondition[],
    inputs: DecisionInput[],
  ): void {
    if (!Array.isArray(conditions)) {
      throw new BadRequestException('conditions must be an array');
    }
    const validInputIds = new Set(inputs.map((i) => i.id));
    for (const cond of conditions) {
      if (!cond.inputId || !validInputIds.has(cond.inputId)) {
        throw new BadRequestException(`Condition references unknown input: ${cond.inputId}`);
      }
      if (!VALID_OPERATORS.has(cond.operator)) {
        throw new BadRequestException(`Unknown operator: ${cond.operator}`);
      }
    }
  }
}
