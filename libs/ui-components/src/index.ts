/**
 * Plan §12.1 — shared UI components used across builders.
 *
 * Distinct from `@hubblewave/ui` (low-level primitives like
 * HubbleDataGrid, glass surfaces, motion provider) — this lib hosts
 * the cross-builder composites: data pill picker, condition builder,
 * code editor (Monaco wrapper), and the Application picker every
 * artifact-create flow needs.
 */

export {
  DataPillPicker,
  type DataPill,
  type DataPillCategory,
  type DataPillKind,
} from './lib/DataPillPicker';

export {
  DataPillButton,
  type DataPillButtonProps,
} from './lib/DataPillButton';

export {
  useDataPillCategories,
  type DataPillSchemaProperty,
} from './lib/useDataPillCategories';

export { ConditionBuilder } from './lib/ConditionBuilder';

export {
  CodeEditor,
  type CodeEditorProps,
  type CodeEditorLanguage,
} from './lib/CodeEditor';

export {
  ApplicationPicker,
  type ApplicationPickerProps,
  type ApplicationOption,
} from './lib/ApplicationPicker';
