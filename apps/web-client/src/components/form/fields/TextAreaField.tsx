import React, { useState } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { AiActionBadge, AiActionType } from '@hubblewave/ui';
import { avaService } from '../../../services/ava.service';

export const TextAreaField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Convert value to string safely
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);

  const handleAiAction = async (action: AiActionType) => {
    if (!strValue || isAiLoading) return;
    
    setIsAiLoading(true);
    try {
      const result = await avaService.transformText({
        text: strValue,
        instruction: action,
        context: { label: field.label }
      });
      onChange(result.text);
    } catch (err) {
      console.error('AI Transform failed', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.config?.placeholder}
          disabled={disabled || isAiLoading}
          readOnly={readOnly}
          rows={field.config?.rows || 4}
          maxLength={field.config?.validators?.maxLength}
          className={`${getInputClasses({ error, readOnly, disabled: disabled || isAiLoading })} min-h-[100px] resize-y`}
        />
        
        {/* AI Action Badge - Show only if not readonly and value exists (or empty if we want to allow 'Generate' later) */}
        {!readOnly && !disabled && (
          <div className="absolute top-2 right-2">
            <AiActionBadge 
              onAction={handleAiAction} 
              isLoading={isAiLoading}
              className="bg-card/80 backdrop-blur-sm shadow-sm"
            />
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};

