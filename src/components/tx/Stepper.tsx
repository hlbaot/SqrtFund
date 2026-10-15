import React from "react";
import { Check } from "lucide-react";

export type StepState = "upcoming" | "current" | "completed";

export interface StepItem {
  id: number;
  label: string;
  description?: string;
  state: StepState;
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export function Stepper({ steps, className = "" }: StepperProps) {
  return (
    <nav aria-label="Donation progress steps" className={`w-full ${className}`}>
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = step.state === "completed";
          const isCurrent = step.state === "current";
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={`flex items-center ${isLast ? "flex-none" : "flex-1"}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isCompleted
                      ? "bg-money text-foreground"
                      : isCurrent
                      ? "bg-primary text-foreground ring-4 ring-primary/20"
                      : "bg-surface-2 text-muted border border-line-strong"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step.id}
                </div>
                <div className="flex flex-col">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-foreground"
                        : isCompleted
                        ? "text-foreground"
                        : "text-muted"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="text-xs text-muted">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={`mx-3 h-0.5 flex-1 transition-colors ${
                    isCompleted ? "bg-money" : "bg-surface-2"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
