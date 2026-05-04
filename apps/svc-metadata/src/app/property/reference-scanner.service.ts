import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PropertyDefinition,
  ViewDefinitionRevision,
  AutomationRule,
  ClientScript,
  FormDefinition,
} from '@hubblewave/instance-db';

/**
 * A reference to the property from a formula on another property.
 */
export interface FormulaReference {
  propertyCode: string;
  collectionCode: string;
  expression: string;
}

/**
 * A reference from a view definition revision (any layout/binding/action JSONB
 * that contains the property code or column name as a string).
 */
export interface ViewReference {
  viewCode: string;
  viewName: string;
}

/**
 * A reference from an automation rule. matchedIn indicates which JSONB column
 * the property code was found in.
 */
export interface AutomationReference {
  automationCode: string;
  automationName: string;
  matchedIn: 'condition' | 'action' | 'filter';
}

/**
 * A reference from a form definition layout.
 */
export interface FormReference {
  formCode: string;
  formName: string;
}

/**
 * A reference from a validation rule expression.
 */
export interface ValidationRuleReference {
  ruleCode: string;
  expression: string;
}

/**
 * A reference from a display rule condition string.
 */
export interface DisplayRuleReference {
  ruleCode: string;
}

export interface PropertyReferenceReport {
  formulas: FormulaReference[];
  views: ViewReference[];
  automations: AutomationReference[];
  forms: FormReference[];
  validationRules: ValidationRuleReference[];
  displayRules: DisplayRuleReference[];
  total: number;
}

/**
 * Scans the metadata dictionary for any references to a given property.
 *
 * Used as a pre-check before property delete to surface dependents instead of
 * silently breaking formulas, views, automations, etc. Operators must
 * explicitly force-delete to override.
 *
 * Strategy: defensive text-search over JSONB columns. Both the property's
 * `code` (logical) and its `columnName` (physical) are matched, since
 * different sub-systems reference properties by different identifiers.
 */
@Injectable()
export class PropertyReferenceScanner {
  constructor(
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(ViewDefinitionRevision)
    private readonly viewRevisionRepo: Repository<ViewDefinitionRevision>,
    @InjectRepository(AutomationRule)
    private readonly automationRepo: Repository<AutomationRule>,
    @InjectRepository(ClientScript)
    private readonly clientScriptRepo: Repository<ClientScript>,
    @InjectRepository(FormDefinition)
    private readonly formRepo: Repository<FormDefinition>,
  ) {}

  async findReferences(prop: PropertyDefinition): Promise<PropertyReferenceReport> {
    const [
      formulas,
      views,
      automations,
      forms,
      validationRules,
      displayRules,
    ] = await Promise.all([
      this.findFormulaReferences(prop),
      this.findViewReferences(prop),
      this.findAutomationReferences(prop),
      this.findFormReferences(prop),
      this.findValidationRuleReferences(prop),
      this.findDisplayRuleReferences(prop),
    ]);

    return {
      formulas,
      views,
      automations,
      forms,
      validationRules,
      displayRules,
      total:
        formulas.length +
        views.length +
        automations.length +
        forms.length +
        validationRules.length +
        displayRules.length,
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // Formulas: stored on PropertyDefinition.config.formula (jsonb)
  // ───────────────────────────────────────────────────────────────────

  private async findFormulaReferences(prop: PropertyDefinition): Promise<FormulaReference[]> {
    const candidates = await this.propertyRepo
      .createQueryBuilder('p')
      .leftJoin('collection_definitions', 'c', 'c.id = p.collection_id')
      .where('p.id != :id', { id: prop.id })
      .andWhere('p.is_active = :active', { active: true })
      .andWhere(
        // Defensive: match either the property code or the physical column
        // name within the formula text stored under config.formula.
        "(p.config->>'formula' LIKE :codePattern OR p.config->>'formula' LIKE :columnPattern)",
        {
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .select(['p.code', 'p.config', 'c.code'])
      .addSelect('c.code', 'collectionCode')
      .getRawMany<{
        p_code: string;
        p_config: Record<string, unknown>;
        collectionCode: string;
      }>();

    const refs: FormulaReference[] = [];
    for (const row of candidates) {
      const expression = (row.p_config?.formula as string | undefined) ?? '';
      if (this.expressionReferencesProperty(expression, prop)) {
        refs.push({
          propertyCode: row.p_code,
          collectionCode: row.collectionCode ?? '',
          expression,
        });
      }
    }
    return refs;
  }

  // ───────────────────────────────────────────────────────────────────
  // Views: scan layout / widget bindings / actions JSONB
  // ───────────────────────────────────────────────────────────────────

  private async findViewReferences(prop: PropertyDefinition): Promise<ViewReference[]> {
    // Cast jsonb to text for substring scan, then word-boundary check in JS.
    const revisions = await this.viewRevisionRepo
      .createQueryBuilder('rev')
      .leftJoin('view_definitions', 'vd', 'vd.id = rev.view_definition_id')
      .where(
        '(rev.layout::text LIKE :codePattern OR rev.widget_bindings::text LIKE :codePattern OR rev.actions::text LIKE :codePattern OR rev.layout::text LIKE :columnPattern OR rev.widget_bindings::text LIKE :columnPattern OR rev.actions::text LIKE :columnPattern)',
        {
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .select(['rev.id', 'rev.layout', 'rev.widget_bindings', 'rev.actions'])
      .addSelect('vd.code', 'viewCode')
      .addSelect('vd.name', 'viewName')
      .getRawMany<{
        rev_layout: Record<string, unknown>;
        rev_widget_bindings: Record<string, unknown>;
        rev_actions: Record<string, unknown>;
        viewCode: string;
        viewName: string;
      }>();

    const seen = new Map<string, ViewReference>();
    for (const row of revisions) {
      const blob = JSON.stringify({
        layout: row.rev_layout,
        bindings: row.rev_widget_bindings,
        actions: row.rev_actions,
      });
      if (!this.blobReferencesProperty(blob, prop)) {
        continue;
      }
      const key = row.viewCode ?? '';
      if (!seen.has(key)) {
        seen.set(key, {
          viewCode: row.viewCode ?? '',
          viewName: row.viewName ?? '',
        });
      }
    }
    return Array.from(seen.values());
  }

  // ───────────────────────────────────────────────────────────────────
  // Automations: scan condition / actions JSONB and watchProperties
  // ───────────────────────────────────────────────────────────────────

  private async findAutomationReferences(prop: PropertyDefinition): Promise<AutomationReference[]> {
    const candidates = await this.automationRepo
      .createQueryBuilder('a')
      .where(
        '(a.condition::text LIKE :codePattern OR a.actions::text LIKE :codePattern OR a.watch_properties::text LIKE :codePattern OR a.condition::text LIKE :columnPattern OR a.actions::text LIKE :columnPattern OR a.watch_properties::text LIKE :columnPattern)',
        {
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .getMany();

    const refs: AutomationReference[] = [];
    for (const auto of candidates) {
      const conditionBlob = JSON.stringify({
        condition: auto.condition,
        watch: auto.watchProperties,
      });
      const actionBlob = JSON.stringify(auto.actions ?? null);

      if (this.blobReferencesProperty(conditionBlob, prop)) {
        refs.push({
          automationCode: auto.id,
          automationName: auto.name,
          matchedIn: 'condition',
        });
      } else if (this.blobReferencesProperty(actionBlob, prop)) {
        refs.push({
          automationCode: auto.id,
          automationName: auto.name,
          matchedIn: 'action',
        });
      }
    }
    return refs;
  }

  // ───────────────────────────────────────────────────────────────────
  // Forms: scan layout JSONB
  // ───────────────────────────────────────────────────────────────────

  private async findFormReferences(prop: PropertyDefinition): Promise<FormReference[]> {
    const candidates = await this.formRepo
      .createQueryBuilder('f')
      .where('f.collection_id = :cid', { cid: prop.collectionId })
      .andWhere(
        '(f.layout::text LIKE :codePattern OR f.layout::text LIKE :columnPattern)',
        {
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .getMany();

    const refs: FormReference[] = [];
    for (const form of candidates) {
      const blob = JSON.stringify(form.layout ?? null);
      if (this.blobReferencesProperty(blob, prop)) {
        refs.push({
          formCode: form.id,
          formName: form.name,
        });
      }
    }
    return refs;
  }

  // ───────────────────────────────────────────────────────────────────
  // Validation rules: live on PropertyDefinition.validationRules JSONB.
  // Cross-property validation expressions reference other property codes.
  // ───────────────────────────────────────────────────────────────────

  private async findValidationRuleReferences(
    prop: PropertyDefinition,
  ): Promise<ValidationRuleReference[]> {
    const candidates = await this.propertyRepo
      .createQueryBuilder('p')
      .where('p.id != :id', { id: prop.id })
      .andWhere('p.is_active = :active', { active: true })
      .andWhere(
        '(p.validation_rules::text LIKE :codePattern OR p.validation_rules::text LIKE :columnPattern)',
        {
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .getMany();

    const refs: ValidationRuleReference[] = [];
    for (const candidate of candidates) {
      const blob = JSON.stringify(candidate.validationRules ?? null);
      if (this.blobReferencesProperty(blob, prop)) {
        refs.push({
          ruleCode: candidate.code,
          expression: blob,
        });
      }
    }
    return refs;
  }

  // ───────────────────────────────────────────────────────────────────
  // Display rules: stored as ClientScript rows whose actions show / hide /
  // require properties. Match by watchProperty and serialized actions.
  // ───────────────────────────────────────────────────────────────────

  private async findDisplayRuleReferences(prop: PropertyDefinition): Promise<DisplayRuleReference[]> {
    const candidates = await this.clientScriptRepo
      .createQueryBuilder('cs')
      .where('cs.collection_id = :cid', { cid: prop.collectionId })
      .andWhere(
        '(cs.watch_property = :code OR cs.actions::text LIKE :codePattern OR cs.condition::text LIKE :codePattern OR cs.actions::text LIKE :columnPattern OR cs.condition::text LIKE :columnPattern)',
        {
          code: prop.code,
          codePattern: `%${prop.code}%`,
          columnPattern: `%${prop.columnName}%`,
        },
      )
      .getMany();

    const refs: DisplayRuleReference[] = [];
    for (const script of candidates) {
      const blob = JSON.stringify({
        actions: script.actions ?? null,
        condition: script.condition ?? null,
        watch: script.watchProperty ?? null,
      });
      if (script.watchProperty === prop.code || this.blobReferencesProperty(blob, prop)) {
        refs.push({ ruleCode: script.id });
      }
    }
    return refs;
  }

  // ───────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────

  /**
   * Word-boundary check so that property `name` does not match `username`.
   * Allows the property identifier to be surrounded by typical syntax characters
   * found in formulas, conditions, JSON keys and string values.
   */
  private expressionReferencesProperty(expression: string, prop: PropertyDefinition): boolean {
    if (!expression) return false;
    return this.matches(expression, prop.code) || this.matches(expression, prop.columnName);
  }

  private blobReferencesProperty(blob: string, prop: PropertyDefinition): boolean {
    if (!blob) return false;
    return this.matches(blob, prop.code) || this.matches(blob, prop.columnName);
  }

  private matches(haystack: string, needle: string): boolean {
    if (!needle) return false;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`);
    return pattern.test(haystack);
  }
}
