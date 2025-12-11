import React from 'react';
import { ChevronRight, MoreVertical, Clock, User } from 'lucide-react';
import { CustomizationBadge, CustomizationType } from './CustomizationBadge';

interface ConfigCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  customizationType?: CustomizationType;
  isActive?: boolean;
  lastModified?: {
    at: string;
    by?: string;
  };
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  title,
  subtitle,
  description,
  icon,
  customizationType,
  isActive = true,
  lastModified,
  onClick,
  onMenuClick,
  actions,
  className = '',
  children,
}) => {
  return (
    <div
      className={`
        bg-white rounded-xl border transition-all
        ${onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-md' : ''}
        ${isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {icon && (
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-slate-900 truncate">{title}</h3>
                {customizationType && (
                  <CustomizationBadge type={customizationType} size="sm" />
                )}
                {!isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    Inactive
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-slate-500 truncate mt-0.5">{subtitle}</p>
              )}
              {description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {actions}
            {onMenuClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClick(e);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
            {onClick && (
              <ChevronRight className="h-5 w-5 text-slate-300" />
            )}
          </div>
        </div>

        {lastModified && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(lastModified.at).toLocaleDateString()}
            </span>
            {lastModified.by && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {lastModified.by}
              </span>
            )}
          </div>
        )}

        {children && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConfigCardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export const ConfigCardGrid: React.FC<ConfigCardGridProps> = ({
  children,
  columns = 2,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
};
