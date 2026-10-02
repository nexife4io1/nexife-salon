import type { ReactNode } from "react";

/** Page title block (mockup: "Branches" + subtitle + primary action on the right). */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Small inline chips next to the title, e.g. a "Demo data" badge. */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-headline-md font-semibold text-on-surface md:text-headline-lg">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-2 max-w-2xl text-body-md text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
