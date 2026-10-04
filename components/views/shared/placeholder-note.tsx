import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Marks an intentional skeleton placeholder and names the roadmap step that
 * fills it in. Remove when the module is implemented.
 */
export function PlaceholderNote({ step, children }: { step: string; children: ReactNode }) {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-card border border-dashed border-outline-variant/70 bg-surface-container-low/60 px-5 py-4 text-body-sm text-secondary">
      <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-primary" />
      <p>
        <span className="font-semibold text-on-surface-variant">Coming in {step}.</span> {children}
      </p>
    </div>
  );
}
