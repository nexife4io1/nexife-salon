import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-container-low text-primary">
        <Icon name={icon} size={22} />
      </span>
      <p className="font-headline text-headline-sm font-semibold text-on-surface">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body-sm text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
