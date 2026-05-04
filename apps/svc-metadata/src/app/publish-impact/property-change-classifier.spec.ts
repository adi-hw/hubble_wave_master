import { classifyPropertyChange } from './property-change-classifier';

const baseProp = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  code: 'priority',
  name: 'Priority',
  description: 'Order of importance',
  propertyTypeId: 'pt-text',
  columnName: 'priority',
  config: {},
  isRequired: false,
  isUnique: false,
  isIndexed: false,
  validationRules: {},
  defaultValue: null,
  defaultValueType: 'static',
  position: 1,
  isVisible: true,
  isReadonly: false,
  displayFormat: null,
  placeholder: null,
  helpText: null,
  referenceCollectionId: null,
  referenceDisplayProperty: null,
  referenceFilter: null,
  choiceListId: null,
  ownerType: 'custom',
  isSystem: false,
  isActive: true,
  isSearchable: false,
  isSortable: true,
  isFilterable: true,
  isPhi: false,
  isPii: false,
  isSensitive: false,
  maskingStrategy: 'none',
  maskValue: null,
  requiresBreakGlass: false,
  metadata: {},
  ...overrides,
});

describe('classifyPropertyChange', () => {
  describe('change kind detection', () => {
    it('throws when both payloads are null', () => {
      expect(() =>
        classifyPropertyChange('priority', null, null),
      ).toThrow('classifyPropertyChange called with both payloads null');
    });

    it('classifies a new property as "added"', () => {
      const report = classifyPropertyChange('priority', null, baseProp());
      expect(report.changeKind).toBe('added');
    });

    it('classifies a removed property as "removed"', () => {
      const report = classifyPropertyChange('priority', baseProp(), null);
      expect(report.changeKind).toBe('removed');
    });

    it('classifies a same-shape pair as "modified" with no changes', () => {
      const old = baseProp();
      const next = baseProp();
      const report = classifyPropertyChange('priority', old, next);
      expect(report.changeKind).toBe('modified');
      expect(report.classification).toBe('cosmetic');
      expect(report.fieldChanges).toHaveLength(0);
    });
  });

  describe('addition rules', () => {
    it('a new optional property is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        null,
        baseProp({ isRequired: false }),
      );
      expect(report.classification).toBe('structural');
    });

    it('a new required property without a default is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        null,
        baseProp({ isRequired: true, defaultValue: null }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('a new required property with a default is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        null,
        baseProp({ isRequired: true, defaultValue: 'medium' }),
      );
      expect(report.classification).toBe('structural');
    });
  });

  describe('removal rules', () => {
    it('a removed property is always breaking', () => {
      const report = classifyPropertyChange('priority', baseProp(), null);
      expect(report.classification).toBe('breaking');
    });
  });

  describe('cosmetic field changes', () => {
    it('label-only change is cosmetic', () => {
      const old = baseProp({ name: 'Priority' });
      const next = baseProp({ name: 'Severity Level' });
      const report = classifyPropertyChange('priority', old, next);
      expect(report.classification).toBe('cosmetic');
    });

    it('description change is cosmetic', () => {
      const old = baseProp({ description: 'Old description' });
      const next = baseProp({ description: 'New description' });
      const report = classifyPropertyChange('priority', old, next);
      expect(report.classification).toBe('cosmetic');
    });

    it('helpText, placeholder, displayFormat are cosmetic', () => {
      const old = baseProp({ helpText: 'old', placeholder: 'old', displayFormat: 'old' });
      const next = baseProp({ helpText: 'new', placeholder: 'new', displayFormat: 'new' });
      const report = classifyPropertyChange('priority', old, next);
      expect(report.classification).toBe('cosmetic');
    });

    it('position change is cosmetic', () => {
      const old = baseProp({ position: 1 });
      const next = baseProp({ position: 5 });
      const report = classifyPropertyChange('priority', old, next);
      expect(report.classification).toBe('cosmetic');
    });
  });

  describe('structural field changes', () => {
    it('isReadonly toggle is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isReadonly: false }),
        baseProp({ isReadonly: true }),
      );
      expect(report.classification).toBe('structural');
    });

    it('isIndexed toggle is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isIndexed: false }),
        baseProp({ isIndexed: true }),
      );
      expect(report.classification).toBe('structural');
    });

    it('isPhi flag flip is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isPhi: false }),
        baseProp({ isPhi: true }),
      );
      expect(report.classification).toBe('structural');
    });

    it('referenceDisplayProperty change is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ referenceDisplayProperty: 'name' }),
        baseProp({ referenceDisplayProperty: 'email' }),
      );
      expect(report.classification).toBe('structural');
    });
  });

  describe('breaking field changes', () => {
    it('code change is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ code: 'priority' }),
        baseProp({ code: 'severity' }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('columnName change is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ columnName: 'priority' }),
        baseProp({ columnName: 'severity_level' }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('propertyTypeId change is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ propertyTypeId: 'pt-text' }),
        baseProp({ propertyTypeId: 'pt-number' }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('referenceCollectionId change is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ referenceCollectionId: 'col-a' }),
        baseProp({ referenceCollectionId: 'col-b' }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('choiceListId change is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ choiceListId: 'cl-a' }),
        baseProp({ choiceListId: 'cl-b' }),
      );
      expect(report.classification).toBe('breaking');
    });
  });

  describe('isRequired transition rules', () => {
    it('isRequired false→true is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isRequired: false }),
        baseProp({ isRequired: true }),
      );
      expect(report.classification).toBe('breaking');
      expect(report.reasons.join(' ')).toMatch(/NOT NULL/);
    });

    it('isRequired true→false is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isRequired: true }),
        baseProp({ isRequired: false }),
      );
      expect(report.classification).toBe('structural');
    });
  });

  describe('isUnique transition rules', () => {
    it('isUnique false→true is breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isUnique: false }),
        baseProp({ isUnique: true }),
      );
      expect(report.classification).toBe('breaking');
      expect(report.reasons.join(' ')).toMatch(/duplicate/i);
    });

    it('isUnique true→false is structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isUnique: true }),
        baseProp({ isUnique: false }),
      );
      expect(report.classification).toBe('structural');
    });
  });

  describe('worst-case aggregation', () => {
    it('cosmetic + structural = structural', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ name: 'Old', isIndexed: false }),
        baseProp({ name: 'New', isIndexed: true }),
      );
      expect(report.classification).toBe('structural');
    });

    it('cosmetic + breaking = breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ name: 'Old', code: 'priority' }),
        baseProp({ name: 'New', code: 'severity' }),
      );
      expect(report.classification).toBe('breaking');
    });

    it('structural + breaking = breaking', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isIndexed: false, code: 'priority' }),
        baseProp({ isIndexed: true, code: 'severity' }),
      );
      expect(report.classification).toBe('breaking');
    });
  });

  describe('ignored fields', () => {
    it('isActive change does not trigger reclassification', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isActive: true }),
        baseProp({ isActive: false }),
      );
      expect(report.classification).toBe('cosmetic');
      expect(report.fieldChanges.find((f) => f.field === 'isActive')).toBeUndefined();
    });

    it('isSystem change is ignored', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ isSystem: false }),
        baseProp({ isSystem: true }),
      );
      expect(report.classification).toBe('cosmetic');
    });

    it('metadata change is ignored', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ metadata: { foo: 'bar' } }),
        baseProp({ metadata: { foo: 'baz' } }),
      );
      expect(report.classification).toBe('cosmetic');
    });
  });

  describe('report shape', () => {
    it('always includes empty dependents on classifier output', () => {
      const report = classifyPropertyChange('priority', null, baseProp());
      expect(report.dependents).toEqual([]);
    });

    it('records each fieldChange with from/to/reason for modifications', () => {
      const report = classifyPropertyChange(
        'priority',
        baseProp({ name: 'Old' }),
        baseProp({ name: 'New' }),
      );
      const change = report.fieldChanges.find((c) => c.field === 'name');
      expect(change).toBeDefined();
      expect(change?.from).toBe('Old');
      expect(change?.to).toBe('New');
      expect(change?.reason).toBeTruthy();
    });

    it('passes through propertyId and propertyLabel', () => {
      const report = classifyPropertyChange(
        'priority',
        null,
        baseProp(),
        'Priority Label',
        'prop-123',
      );
      expect(report.propertyId).toBe('prop-123');
      expect(report.propertyLabel).toBe('Priority Label');
    });
  });
});
