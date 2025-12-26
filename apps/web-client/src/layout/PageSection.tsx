import React from 'react';

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  description,
  actions,
  children,
  noPadding = false,
}) => (
  <section className="mb-8">
    {(title || description || actions) && (
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          {title && (
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </header>
    )}
    <div className={noPadding ? '' : ''}>
      {children}
    </div>
  </section>
);
