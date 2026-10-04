import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Form field: label-md label 8px above; soft off-white input; 1.5px gold border on focus. */

const control =
  "h-11 w-full rounded-control border-[1.5px] border-transparent bg-surface-container-low px-4 text-body-sm text-on-surface transition-colors placeholder:text-secondary/70 focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none disabled:opacity-60 aria-invalid:border-error/60";

export function Field({ label, htmlFor, hint, errors, children }: { label: string; htmlFor: string; hint?: ReactNode; errors?: string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-label-md text-on-surface-variant">
        {label}
      </label>
      {children}
      {errors?.length ? (
        <p className="text-label-sm text-error" id={`${htmlFor}-error`}>
          {errors[0]}
        </p>
      ) : (
        hint && <p className="text-label-sm text-secondary">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}
