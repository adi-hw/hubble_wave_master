import {
  BUILT_IN_AUTOMATION_ACTIONS,
  AUTOMATION_CODE_ALIASES,
  findAutomationActionByCode,
} from './automation-action-contract';

describe('BUILT_IN_AUTOMATION_ACTIONS catalog', () => {
  it('includes the five canonical structured actions from plan §9.1', () => {
    const codes = BUILT_IN_AUTOMATION_ACTIONS.map((a) => a.code);
    expect(codes).toEqual(
      expect.arrayContaining(['SetField', 'CreateRecord', 'FireEvent', 'CallFlow', 'Abort']),
    );
  });

  it('SetField requires property + value, with optional onlyIfEmpty', () => {
    const setField = BUILT_IN_AUTOMATION_ACTIONS.find((a) => a.code === 'SetField');
    expect(setField).toBeDefined();
    const required = setField!.inputs.filter((i) => i.required).map((i) => i.name);
    expect(required.sort()).toEqual(['property', 'value']);
    expect(setField!.inputs.find((i) => i.name === 'onlyIfEmpty')?.required).toBe(false);
  });

  it('CreateRecord requires collectionCode + values and outputs recordId', () => {
    const createRecord = BUILT_IN_AUTOMATION_ACTIONS.find((a) => a.code === 'CreateRecord');
    expect(createRecord).toBeDefined();
    expect(
      createRecord!.inputs.filter((i) => i.required).map((i) => i.name).sort(),
    ).toEqual(['collectionCode', 'values']);
    expect(createRecord!.outputs[0]?.name).toBe('recordId');
  });

  it('Abort requires a message reason', () => {
    const abort = BUILT_IN_AUTOMATION_ACTIONS.find((a) => a.code === 'Abort');
    expect(abort?.inputs.find((i) => i.name === 'message')?.required).toBe(true);
  });
});

describe('findAutomationActionByCode', () => {
  it('resolves canonical PascalCase codes directly', () => {
    expect(findAutomationActionByCode('SetField')?.code).toBe('SetField');
    expect(findAutomationActionByCode('Abort')?.code).toBe('Abort');
  });

  it('translates legacy snake_case aliases to canonical actions', () => {
    expect(findAutomationActionByCode('set_value')?.code).toBe('SetField');
    expect(findAutomationActionByCode('create_record')?.code).toBe('CreateRecord');
    expect(findAutomationActionByCode('log_event')?.code).toBe('FireEvent');
    expect(findAutomationActionByCode('send_notification')?.code).toBe('SendNotification');
    expect(findAutomationActionByCode('trigger_flow')?.code).toBe('CallFlow');
    expect(findAutomationActionByCode('start_workflow')?.code).toBe('CallFlow');
    expect(findAutomationActionByCode('abort')?.code).toBe('Abort');
  });

  it('set_values is NOT aliased to SetField — multi-property semantics must reach the dedicated handler', () => {
    // set_values writes multiple properties at once; SetField writes
    // exactly one. Mapping the two would route multi-property writes
    // through the single-property handler and silently drop all but
    // one field. Both runtime dispatchers depend on this alias being
    // absent.
    expect(findAutomationActionByCode('set_values')).toBeUndefined();
  });

  it('returns undefined for unknown codes', () => {
    expect(findAutomationActionByCode('NonExistent')).toBeUndefined();
    expect(findAutomationActionByCode('drop_database')).toBeUndefined();
  });

  it('AUTOMATION_CODE_ALIASES maps every alias to a real catalog entry', () => {
    for (const [alias, canonical] of Object.entries(AUTOMATION_CODE_ALIASES)) {
      expect(BUILT_IN_AUTOMATION_ACTIONS.find((a) => a.code === canonical)).toBeDefined();
      // Sanity: alias resolution path agrees with the direct map.
      expect(findAutomationActionByCode(alias)?.code).toBe(canonical);
    }
  });
});
