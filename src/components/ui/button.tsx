import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: {
      default: "bg-primary text-white hover:bg-blue-800",
      outline: "border border-border bg-white text-foreground hover:bg-slate-50",
      ghost: "text-current hover:bg-white/10",
    },
    size: { default: "h-11 px-5", sm: "h-9 px-3" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(variants({ variant, size, className }))} {...props} />;
}
