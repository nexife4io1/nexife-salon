import type { SVGProps } from "react";

/**
 * Minimal inline line-icon set (24px grid, 1.5 stroke) standing in for the
 * mockup's Material Symbols — no font download, no runtime dependency.
 * Add icons here as pages need them.
 */
const paths = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  store: (
    <>
      <path d="M3.5 9 5 4h14l1.5 5" />
      <path d="M3.5 9a2.83 2.83 0 0 0 5.67 0 2.83 2.83 0 0 0 5.66 0 2.83 2.83 0 0 0 5.67 0" />
      <path d="M5 11.5V20h14v-8.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M19 20v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
      <circle cx="12" cy="7.5" r="3.5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-2.33-1.5L14.33 21 12 19.5 9.67 21l-2.34-1.5Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  package: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.9 8.6 18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9Z" />
      <path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 21.5s8-3.8 8-10V5l-8-3-8 3v6.5c0 6.2 8 10 8 10Z" />
      <path d="m9 11.5 2 2 4-4" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M9 21.5v-4h6v4M8.5 7h.01M12 7h.01M15.5 7h.01M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 15h.01M12 15h.01M15.5 15h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.5-4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5" />
      <path d="M10.3 20.5a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.6-2.7 2.6M12 16.5h.01" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M19.5 10c0 5.5-7.5 11.5-7.5 11.5S4.5 15.5 4.5 10a7.5 7.5 0 0 1 15 0Z" />
      <circle cx="12" cy="10" r="2.75" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: (
    <>
      <path d="M9 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H9" />
      <path d="m16 16.5 4.5-4.5L16 7.5M20.5 12H9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  send: (
    <>
      <path d="M21.5 2.5 14.5 21.5l-4-8.5-8.5-4Z" />
      <path d="M21.5 2.5 10.5 13" />
    </>
  ),
  "trending-up": (
    <>
      <path d="m21.5 7-8 8-5-5-6 6" />
      <path d="M15.5 7h6v6" />
    </>
  ),
  inbox: (
    <>
      <path d="M21.5 12.5h-5.5l-2 3h-4l-2-3H2.5" />
      <path d="M5.5 5.1 2.5 12.5V18a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-5.5l-3-7.4A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.9 1.1Z" />
    </>
  ),
  filter: <path d="M3.5 5h17l-6.5 8v5.5l-4 2V13Z" />,
} as const;

export type IconName = keyof typeof paths;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
  /** Decorative by default; pass a label to expose the icon to assistive tech. */
  label?: string;
};

export function Icon({ name, size = 20, label, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
