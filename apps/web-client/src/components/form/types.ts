import type { ModelField } from '../../services/platform.service';

export interface FieldComponentProps<TValue = unknown> {
  field: ModelField;
  value: TValue | undefined;
  onChange: (value: TValue | undefined) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
}
