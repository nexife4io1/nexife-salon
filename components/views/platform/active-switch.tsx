import { cn } from "@/lib/cn";

/** Submit-on-click toggle. Render it inside a <form> whose hidden `active` field holds the *next* value. */
export function ActiveSwitch({ active, pending, label }: { active: boolean; pending?: boolean; label: string }) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={pending}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-primary" : "bg-surface-container-high",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-surface-container-lowest shadow-card transition-transform",
          active && "translate-x-5",
        )}
      />
    </button>
  );
}
