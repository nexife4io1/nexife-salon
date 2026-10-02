import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10 first:mt-0", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            {title && <h2 className="font-headline text-headline-sm font-semibold text-on-surface">{title}</h2>}
            {description && <p className="mt-1 text-body-sm text-secondary">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
