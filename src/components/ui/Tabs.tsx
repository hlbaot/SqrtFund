"use client";

import React, { createContext, useContext } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type TabsContextType = {
  value: string;
  onValueChange: (val: string) => void;
};

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={twMerge(clsx("w-full space-y-4", className))}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={twMerge(
        clsx(
          "inline-flex min-h-11 items-center justify-center border border-line bg-surface text-muted",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isSelected = context.value === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isSelected}
      onClick={() => context.onValueChange(value)}
      className={twMerge(
        clsx(
          "mono-label inline-flex items-center justify-center whitespace-nowrap border-t border-transparent px-4 py-2 transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          isSelected
            ? "gradient-border text-foreground font-semibold"
            : "text-muted hover:bg-surface-2 hover:text-foreground",
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={twMerge(clsx("focus-visible:outline-none", className))}
      {...props}
    >
      {children}
    </div>
  );
}
