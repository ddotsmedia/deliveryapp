import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils.js";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  header?: ReactNode;
  footer?: ReactNode;
};

export function Card({ header, footer, children, className, ...props }: CardProps) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-[var(--color-surface)] shadow-sm", className)} {...props}>
      {header ? <div className="border-b border-slate-200 px-4 py-3 font-semibold">{header}</div> : null}
      <div className="px-4 py-3">{children}</div>
      {footer ? <div className="border-t border-slate-200 px-4 py-3">{footer}</div> : null}
    </div>
  );
}
