import React from 'react';
import { NavSection } from '../../types/navigation';
import { Icon } from '../Icon';
import { useNavigate } from 'react-router-dom';

interface ModulesDrawerProps {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
}

export const ModulesDrawer: React.FC<ModulesDrawerProps> = ({ open, onClose, sections }) => {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-overlay) 60%, transparent)' }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 top-14 rounded-t-3xl px-5 py-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Modules
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' }}
          >
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.name}>
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.name}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => {
                      navigate(item.path ?? `/${item.code}.list`);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors"
                    style={{
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  >
                    <span className="flex items-center gap-2" style={{ color: 'inherit' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      {item.label}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <Icon name="ChevronRight" className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
