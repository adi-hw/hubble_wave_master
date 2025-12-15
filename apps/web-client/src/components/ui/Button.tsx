import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent' | 'outline';
  /** Size of the button */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  /** Shows loading spinner and disables the button */
  loading?: boolean;
  /** Icon to display before the children */
  leftIcon?: React.ReactNode;
  /** Icon to display after the children */
  rightIcon?: React.ReactNode;
  /** Makes the button take full width of container */
  fullWidth?: boolean;
}

/**
 * Modern button component with multiple variants and sizes.
 * Uses the HubbleWave design system tokens.
 *
 * @example
 * // Primary button with gradient
 * <Button variant="primary">Get Started</Button>
 *
 * @example
 * // Loading state
 * <Button loading>Saving...</Button>
 *
 * @example
 * // With icons
 * <Button leftIcon={<Plus />} variant="primary">Add Item</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      success: 'btn-success',
      accent: 'btn-accent',
      outline: 'btn-outline',
    };

    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
      xl: 'btn-xl',
      icon: 'btn-icon btn-md',
    };

    const iconSizes: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'h-3.5 w-3.5',
      sm: 'h-4 w-4',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
      xl: 'h-5 w-5',
      icon: 'h-5 w-5',
    };

    const isDisabled = disabled || loading;
    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        className={cn(
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden="true" />
        ) : (
          leftIcon && (
            <span className={cn(iconSize, 'flex-shrink-0')} aria-hidden="true">
              {leftIcon}
            </span>
          )
        )}
        {size !== 'icon' && children}
        {!loading && rightIcon && (
          <span className={cn(iconSize, 'flex-shrink-0')} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
