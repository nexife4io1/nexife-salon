import type { ReactNode } from "react";
import { Card } from "./card";
import { Icon, type IconName } from "./icon";

/** KPI tile: Manrope metric + small uppercase context label. */
export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && (
          <span className="grid size-9 place-items-center rounded-full bg-surface-container-low text-primary">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className="font-headline text-[2.25rem] leading-none font-bold tracking-[-0.02em] text-on-surface md:text-[2.5rem]">{value}</p>
      {hint && <p className="text-label-sm text-secondary">{hint}</p>}
    </Card>
  );
}
