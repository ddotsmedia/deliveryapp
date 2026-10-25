import { cn } from "../utils.js";

export function LoadingSpinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-brand)]", className)} />
  );
}
