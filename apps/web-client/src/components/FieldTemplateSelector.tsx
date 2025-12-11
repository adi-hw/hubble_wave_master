import React from 'react';
import { FieldTemplate } from '../config/fieldTemplates';

interface TemplateButtonProps {
  template: FieldTemplate;
  onSelect: (template: FieldTemplate) => void;
}

const TemplateButton: React.FC<TemplateButtonProps> = ({ template, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(template)}
    className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
  >
    <span className="text-3xl">{template.icon}</span>
    <span className="font-medium text-sm">{template.name}</span>
    <span className="text-xs text-gray-500">{template.description}</span>
  </button>
);

interface FieldTemplateSelectorProps {
  templates: FieldTemplate[];
  onSelect: (template: FieldTemplate) => void;
  onSkip: () => void;
}

export const FieldTemplateSelector: React.FC<FieldTemplateSelectorProps> = ({
  templates,
  onSelect,
  onSkip,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-md font-semibold mb-2">Quick Start: Use a Template</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select a pre-configured field template or create from scratch
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {templates.map((template) => (
          <TemplateButton key={template.id} template={template} onSelect={onSelect} />
        ))}
      </div>

      <div className="text-center pt-4 border-t">
        <button
          type="button"
          onClick={onSkip}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Or create from scratch →
        </button>
      </div>
    </div>
  );
};
