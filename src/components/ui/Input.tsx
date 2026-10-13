import React, { forwardRef, useId } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      prefixElement,
      suffixElement,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="mono-label block text-muted"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixElement && (
            <div className="pointer-events-none absolute left-3 flex items-center text-muted">
              {prefixElement}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={twMerge(
              clsx(
                "w-full border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
                error ? "border-primary focus:border-primary focus:ring-primary" : "border-line-strong",
                prefixElement && "pl-9",
                suffixElement && "pr-16",
                className
              )
            )}
            {...props}
          />
          {suffixElement && (
            <div className="absolute right-3 flex items-center text-xs font-medium text-muted">
              {suffixElement}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-primary" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
