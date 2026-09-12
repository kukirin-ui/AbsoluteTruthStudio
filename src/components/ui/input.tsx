import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)] outline-none placeholder:text-subtle",
        "transition-[box-shadow] duration-150 focus:shadow-[0_0_0_1px_var(--color-indigo-glow)]",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
