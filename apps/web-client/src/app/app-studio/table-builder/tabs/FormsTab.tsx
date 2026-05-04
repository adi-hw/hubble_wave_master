import React from 'react';
import { FormLayoutPage } from '../../../../features/admin';

/**
 * Forms tab content. Hosts the Record Form layout designer. Slice B
 * (§6.1) keeps this as-is; Phase 2 replaces it with the drag-drop
 * Form Builder (§7.1) plus Display Rule editor (§7.3).
 */
export const FormsTab: React.FC = () => <FormLayoutPage />;
