import type { InputHTMLAttributes } from "react";
import { cn } from "../utils.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helpText?: string;
};

export function Input({ label, error, helpText, id, className, ...props }: InputProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  const describedBy = error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-ink)]">{label}</label>
      <input
        id={inputId}
        dir="auto"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-10 rounded-md border border-slate-300 px-3 text-start", error && "border-[var(--color-danger)]", className)}
        {...props}
      />
      {error ? <p id={`${inputId}-error`} className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {!error && helpText ? <p id={`${inputId}-help`} className="text-sm text-[var(--color-muted)]">{helpText}</p> : null}
    </div>
  );
}
