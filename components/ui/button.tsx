import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

/**
 * Action hierarchy (DESIGN.md › Buttons):
 *   primary   — deep gold, white text. The one high-intent action per view ("Add New Branch").
 *   accent    — champagne gold, charcoal-gold text. AI / premium actions ("Style Studio").
 *   secondary — transparent, charcoal hairline border ("View Branch Details").
 *   ghost     — text only, gold. Subtle tertiary actions.
 */
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control text-label-md whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 group";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 shadow-card active:scale-[0.98]",
  accent: "bg-primary-container text-on-primary-container hover:bg-primary-container/85 active:scale-[0.98]",
  secondary: "border border-secondary/70 text-on-surface hover:border-primary hover:text-primary bg-transparent",
  ghost: "text-primary hover:bg-primary-fixed/40",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-6",
};

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

export function buttonClasses({ variant = "primary", size = "md", fullWidth, className }: Omit<StyleProps, "children">) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

function Content({ icon, trailingIcon, children }: Pick<StyleProps, "icon" | "trailingIcon" | "children">) {
  return (
    <>
      {icon && <Icon name={icon} size={18} />}
      {children}
      {trailingIcon && (
        <Icon name={trailingIcon} size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </>
  );
}

export function Button({
  variant,
  size,
  icon,
  trailingIcon,
  fullWidth,
  className,
  children,
  type = "button",
  ...rest
}: StyleProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type={type} className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  trailingIcon,
  fullWidth,
  className,
  children,
  ...rest
}: StyleProps & Omit<ComponentProps<typeof Link>, "children" | "className">) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </Link>
  );
}
