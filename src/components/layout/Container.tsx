import React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export function Container({
  as: Component = "div",
  className = "",
  children,
  ...props
}: ContainerProps) {
  return (
    <Component
      className={`mx-auto w-full max-w-[var(--container-max)] px-[var(--page-pad)] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
