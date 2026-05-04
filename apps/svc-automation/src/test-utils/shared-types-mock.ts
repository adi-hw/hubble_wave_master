// Test-only stub for `@hubblewave/shared-types`. The real barrel imports
// in-flight modules (condition-evaluator, action-contract, etc) that
// haven't been committed yet. We expose just the constants svc-automation
// references at unit-test time.

export const AUTOMATION_CODE_ALIASES: Record<string, string> = {
  SetField: 'set_value',
  CreateRecord: 'create_record',
  FireEvent: 'log_event',
  CallFlow: 'start_workflow',
  Abort: 'abort',
  SendNotification: 'send_notification',
  AddError: 'add_error',
  AddWarning: 'add_warning',
  AddComment: 'add_comment',
};
