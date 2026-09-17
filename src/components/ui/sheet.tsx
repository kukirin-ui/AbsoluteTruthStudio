import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "left",
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "left" | "right";
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm data-[state=open]:animate-[mesh-in_250ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex h-full w-[min(100%,22rem)] flex-col bg-surface shadow-[0_0_0_1px_rgb(255_255_255/0.08)]",
          "transition-[transform] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-[state=closed]:duration-300",
          side === "left"
            ? "inset-y-0 left-0 data-[state=closed]:-translate-x-full"
            : "inset-y-0 right-0 data-[state=closed]:translate-x-full",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <DialogPrimitive.Title className="font-display text-base font-medium tracking-tight text-fg">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
