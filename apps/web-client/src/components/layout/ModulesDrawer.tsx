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
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-14 bg-slate-950 rounded-t-3xl border-t border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-100">Modules</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center">
            <Icon name="X" className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.name}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{section.name}</div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => {
                      navigate(item.path ?? `/${item.code}.list`);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-200 bg-slate-900/80 border border-slate-800 hover:bg-slate-800/90"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name={item.icon} className="h-4 w-4 text-slate-400" />
                      {item.label}
                    </span>
                    <Icon name="ChevronRight" className="h-4 w-4 text-slate-500" />
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
