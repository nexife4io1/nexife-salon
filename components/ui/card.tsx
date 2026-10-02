import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Surface Level 1: white, 1.5rem radius, ambient shadow, hairline border. */
export function Card({
  className,
  padding = "md",
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: "none" | "md" | "lg"; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-outline-variant/15 bg-surface-container-lowest shadow-card",
        padding === "md" && "p-6",
        padding === "lg" && "p-8",
        interactive && "transition-shadow duration-300 hover:shadow-raised",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="font-headline text-headline-sm font-semibold text-on-surface">{title}</h3>
        {description && <p className="mt-1 text-body-sm text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * AI "smart block" (DESIGN.md › AI Insights): soft glass, slightly larger
 * radius, champagne accent line on the left edge = "active intelligence".
 */
export function SmartBlock({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-smart border border-primary-container/30 bg-surface-container-lowest/70 p-6 shadow-card backdrop-blur-md",
        "before:absolute before:inset-y-5 before:left-0 before:w-1 before:rounded-r-full before:bg-primary-container",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
