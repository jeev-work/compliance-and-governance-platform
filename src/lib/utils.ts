import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared Recharts tooltip style — uses semantic popover tokens for readability on dark surfaces. */
export const CHART_TOOLTIP = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    color: 'hsl(var(--popover-foreground))',
    fontSize: 11,
    boxShadow: '0 4px 12px hsl(0 0% 0% / 0.4)',
  } as React.CSSProperties,
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 } as React.CSSProperties,
  itemStyle: { color: 'hsl(var(--foreground))' } as React.CSSProperties,
};
