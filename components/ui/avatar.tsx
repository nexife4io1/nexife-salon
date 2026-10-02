import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Initials avatar (no remote images in the skeleton). */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-fixed/70 font-headline font-semibold text-on-primary-container",
        size === "sm" ? "size-8 text-[0.6875rem]" : "size-10 text-label-md",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
