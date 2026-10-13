import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "mono-label inline-flex items-center justify-center border transition-colors duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-45 select-none";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "gradient-border text-foreground hover:bg-surface-2",
      secondary: "border-line-strong bg-surface text-foreground hover:bg-surface-2 hover:border-primary/70",
      outline: "border-line-strong bg-transparent text-foreground hover:bg-surface hover:border-primary/70",
      ghost: "border-transparent bg-transparent text-muted hover:text-foreground",
      destructive: "border-primary bg-primary/10 text-primary hover:bg-primary hover:text-foreground",
      accent: "border-money bg-money/10 text-money hover:bg-money hover:text-bg",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "min-h-8 px-3 py-1.5 gap-1.5",
      md: "min-h-10 px-4 py-2 gap-2",
      lg: "min-h-12 px-6 py-3 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(
          clsx(
            baseStyles,
            variantStyles[variant],
            sizeStyles[size],
            fullWidth && "w-full",
            className
          )
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="-ml-1 mr-2 h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
