import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Rounded search pill (mockup top bar). Border appears only on focus. */
export function SearchField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{rest["aria-label"] ?? rest.placeholder ?? "Search"}</span>
      <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-secondary" />
      <input
        type="search"
        className="h-10 w-full rounded-full border-[1.5px] border-transparent bg-surface-container-low pr-4 pl-10 text-body-sm text-on-surface transition-colors placeholder:text-secondary focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none"
        {...rest}
      />
    </label>
  );
}
