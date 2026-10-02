import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Pill-shaped, low-saturation status chip. Use sparingly. */
export type BadgeTone = "success" | "neutral" | "gold" | "warning" | "error";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-container text-on-success-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
  gold: "bg-primary-fixed/60 text-on-primary-container",
  warning: "bg-warning-container text-on-warning-container",
  error: "bg-error-container text-on-error-container",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}
