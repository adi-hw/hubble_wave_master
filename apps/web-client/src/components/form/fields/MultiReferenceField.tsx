import React from 'react';
import { FieldComponentProps } from '../types';
import { NotImplementedField } from './NotImplementedField';

// Placeholder until a proper multi-reference selector is implemented.
export const MultiReferenceField: React.FC<FieldComponentProps<any>> = (props) => (
  <NotImplementedField {...props} />
);
