import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-pill text-[13px] font-semibold tracking-[-0.01em] ring-offset-bg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ink text-bg hover:bg-ink2 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0",
        outline: "border border-border bg-bg2 hover:bg-bg3 hover:border-border2",
        ghost: "hover:bg-bg3",
        gold: "bg-gold text-ink hover:bg-[#eab308] shadow-sm hover:shadow-md hover:-translate-y-[1px]",
      },
      size: {
        default: "h-[42px] px-[22px]",
        sm: "h-[36px] px-[16px] text-[12px]",
        lg: "h-[52px] px-[28px] text-[14px]",
        icon: "h-[42px] w-[42px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
export { Button, buttonVariants };
