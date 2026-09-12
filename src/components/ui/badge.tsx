import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
  {
    variants: {
      variant: {
        muted: "bg-elevated text-muted",
        indigo: "bg-indigo/15 text-indigo-glow",
        emerald: "bg-emerald/15 text-emerald-glow",
        danger: "bg-danger/15 text-danger",
        warn: "bg-warn/15 text-warn-glow",
        outline: "text-muted shadow-[0_0_0_1px_rgb(255_255_255/0.1)]",
      },
    },
    defaultVariants: { variant: "muted" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
