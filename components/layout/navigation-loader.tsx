import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export function NavigationLoader({
  variant = "page",
  label = "Preparing your next view...",
}: {
  variant?: "overlay" | "page";
  label?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center",
        variant === "overlay" ? "pointer-events-none fixed inset-0 z-[70] bg-surface/70 backdrop-blur-[1px]" : "min-h-[48vh]",
      )}
    >
      <div role="status" aria-live="polite" className="rounded-card border border-outline-variant/45 bg-surface-container-low/95 px-6 py-4 shadow-card">
        <span className="sr-only">{label}</span>
        <div aria-hidden className="mb-3 flex items-center gap-2 text-secondary">
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="eyebrow text-secondary">Salon flow</span>
        </div>
        <div aria-hidden className="relative h-12 w-72 max-w-[75vw]">
          <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-outline-variant/60" />
          <div className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-primary-container motion-reduce:animate-none animate-[barber-strand_1.15s_ease-in-out_infinite]" />
          <span className="absolute top-1/2 left-0 -translate-y-1/2">
            <span className="block text-primary motion-reduce:animate-none animate-[barber-shear_1.15s_cubic-bezier(0.4,0,0.2,1)_infinite]">
              <Icon name="scissors" size={22} />
            </span>
          </span>
        </div>
        <p className="mt-3 text-label-sm text-secondary">{label}</p>
      </div>
    </div>
  );
}
