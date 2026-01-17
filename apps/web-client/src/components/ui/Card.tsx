import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the card */
  variant?: 'default' | 'elevated' | 'interactive' | 'selected';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Card component for containing related content.
 * Uses the HubbleWave design system tokens.
 *
 * @example
 * <Card>
 *   <CardHeader title="Settings" description="Manage your preferences" />
 *   <CardContent>Content here</CardContent>
 *   <CardFooter><Button>Save</Button></CardFooter>
 * </Card>
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClasses = {
    default: 'card',
    elevated: 'card-elevated',
    interactive: 'card-interactive',
    selected: 'card-selected',
  };

  return (
    <div
      className={cn(variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Main title of the card */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional action element (button, menu, etc.) */
  action?: React.ReactNode;
  /** Icon to display before the title */
  icon?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  action,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div
      className={cn('flex items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"
          >
            {icon}
          </div>
        )}
        <div>
          <h3
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h3>
          {description && (
            <p
              className="mt-1 text-sm text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={cn('mt-4', className)} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alignment of footer content */
  align?: 'left' | 'center' | 'right' | 'between';
}

export const CardFooter: React.FC<CardFooterProps> = ({
  align = 'right',
  className = '',
  children,
  ...props
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 pt-4 mt-4 border-t border-border',
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
