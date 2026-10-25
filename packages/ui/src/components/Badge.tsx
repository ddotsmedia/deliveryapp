import { cva } from "class-variance-authority";
import type { OrderStatus } from "@ufd/types";
import { cn } from "../utils.js";

export const statusTone: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PLACED: "neutral",
  PAYMENT_AUTHORIZED: "info",
  MERCHANT_PENDING: "warning",
  ACCEPTED: "info",
  PREPARING: "info",
  READY: "success",
  PICKED_UP: "info",
  DELIVERED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  REFUNDED: "neutral",
};

const badge = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-slate-100 text-slate-700",
      info: "bg-sky-100 text-sky-800",
      success: "bg-green-100 text-green-800",
      warning: "bg-amber-100 text-amber-800",
      danger: "bg-red-100 text-red-800",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function StatusBadge({ status, label, className }: { status: OrderStatus; label: string; className?: string }) {
  return <span className={cn(badge({ tone: statusTone[status] }), className)}>{label}</span>;
}
