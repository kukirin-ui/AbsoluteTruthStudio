import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full resize-none rounded-lg bg-elevated px-3 py-2.5 text-sm leading-relaxed text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)] outline-none placeholder:text-subtle",
        "transition-[box-shadow] duration-150 focus:shadow-[0_0_0_1px_var(--color-indigo-glow)]",
        className,
      )}
      {...props}
    />
  );
}
