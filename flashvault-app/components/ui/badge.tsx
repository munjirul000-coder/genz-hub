import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-[10px] py-[3px] text-[10px] font-bold tracking-[0.06em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ink",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-bg",
        secondary: "border-border bg-bg3 text-ink2",
        gold: "border-gold/30 bg-goldLight text-goldDark",
        outline: "text-ink border-border",
        live: "border-transparent bg-[#0a0a0a] text-white shadow-sm",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
