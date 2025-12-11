import React from 'react';
import { LucideIcon, FileQuestion, Search, Plus, Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'search' | 'create';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
  className = '',
}) => {
  // Default icons based on variant
  const defaultIcons: Record<string, LucideIcon> = {
    default: Inbox,
    search: Search,
    create: FileQuestion,
  };

  const IconComponent = Icon || defaultIcons[variant];

  return (
    <div className={`empty-state ${className}`}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <IconComponent
          className="w-7 h-7"
          style={{ color: 'var(--hw-text-muted)' }}
        />
      </div>
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--hw-text)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm max-w-sm mx-auto mb-6"
          style={{ color: 'var(--hw-text-muted)' }}
        >
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3 justify-center">
          {actionLabel && onAction && (
            <Button
              variant="primary"
              size="md"
              leftIcon={variant === 'create' ? <Plus className="h-4 w-4" /> : undefined}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Preset empty states for common scenarios
export const NoResultsState: React.FC<{
  query?: string;
  onClear?: () => void;
}> = ({ query, onClear }) => (
  <EmptyState
    variant="search"
    title="No results found"
    description={
      query
        ? `No items match "${query}". Try adjusting your search.`
        : 'No items match your current filters.'
    }
    actionLabel={onClear ? 'Clear filters' : undefined}
    onAction={onClear}
  />
);

export const NoDataState: React.FC<{
  itemName?: string;
  onCreate?: () => void;
}> = ({ itemName = 'items', onCreate }) => (
  <EmptyState
    variant="create"
    title={`No ${itemName} yet`}
    description={`Get started by creating your first ${itemName.slice(0, -1)}.`}
    actionLabel={`Create ${itemName.slice(0, -1)}`}
    onAction={onCreate}
  />
);

export const NoCustomizationsState: React.FC<{
  onCreateCustomization?: () => void;
}> = ({ onCreateCustomization }) => (
  <EmptyState
    variant="default"
    title="No customizations"
    description="This tenant is using the default platform configuration. Create customizations to tailor the platform to your needs."
    actionLabel="Create Customization"
    onAction={onCreateCustomization}
  />
);

export const NoUpgradeImpactsState: React.FC = () => (
  <EmptyState
    variant="default"
    title="No impacts detected"
    description="Your customizations are compatible with this upgrade. No action required."
  />
);

export default EmptyState;
