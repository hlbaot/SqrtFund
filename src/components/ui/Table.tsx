import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Table({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto custom-scrollbar border border-line">
      <table
        className={twMerge(clsx("w-full caption-bottom text-sm text-left", className))}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={twMerge(clsx("mono-label bg-surface-2 text-muted", className))} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={twMerge(clsx("divide-y divide-line", className))} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={twMerge(
        clsx(
          "transition-colors hover:bg-surface-2 data-[state=selected]:bg-surface-2",
          props.onClick && "cursor-pointer",
          className
        )
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={twMerge(
        clsx("h-11 px-4 text-left align-middle font-medium text-muted", className)
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={twMerge(clsx("p-4 align-middle text-foreground", className))} {...props}>
      {children}
    </td>
  );
}
