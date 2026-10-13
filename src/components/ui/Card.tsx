import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Frame } from "./Frame";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
}

export function Card({ className, title, children, ...props }: CardProps) {
  return (
    <Frame
      className={twMerge(
        clsx(
          "text-foreground transition-colors",
          className
        )
      )}
      {...props}
    >
      {title ? (
        <>
          <div className="border-b border-line px-6 py-4">
            <h2 className="mono-label text-foreground">{title}</h2>
          </div>
          <div className="p-6">{children}</div>
        </>
      ) : (
        children
      )}
    </Frame>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("flex flex-col space-y-1.5 p-6", className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx("text-lg font-semibold leading-none tracking-tight text-foreground", className)
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge(clsx("text-sm text-muted", className))} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("p-6 pt-0", className))} {...props}>{children}</div>;
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("flex items-center p-6 pt-0", className))} {...props}>
      {children}
    </div>
  );
}
