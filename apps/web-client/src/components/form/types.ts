import type { ModelProperty } from '../../services/platform.service';

export interface FieldComponentProps<TValue = unknown> {
  field: ModelProperty;
  value: TValue | undefined;
  onChange: (value: TValue | undefined) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
}
