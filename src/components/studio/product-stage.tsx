import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReelPlayer } from "@/components/studio/reel-player";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clapperboard, Download, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export function ProductStage({
  media,
  compact = false,
  onDismiss,
  onRetry,
}: {
  media?: MediaAsset;
  compact?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  if (!media) return null;

  async function download() {
    const href = media?.url ?? media?.shots?.find((s) => s.url)?.url;
    if (!href) return;
    try {
      let out = href;
      let revoke: string | null = null;
      if (!out.startsWith("data:") && !out.startsWith("blob:")) {
        const res = await fetch("/api/imagine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "proxy", url: out }),
        });
        if (!res.ok) {
          window.open(out, "_blank", "noopener,noreferrer");
          return;
        }
        const blob = await res.blob();
        out = URL.createObjectURL(blob);
        revoke = out;
      }
      const a = document.createElement("a");
      a.href = out;
      a.download = media?.kind === "video" ? "spot.mp4" : "frame.jpg";
      a.click();
      if (revoke) setTimeout(() => URL.revokeObjectURL(revoke!), 2000);
      toast.success("Download started");
    } catch {
      toast.error("Could not download the file");
    }
  }

  const frame = cn(
    "relative overflow-hidden rounded-xl bg-panel shadow-[0_0_0_1px_rgb(255_255_255/0.06)]",
    compact ? "max-h-64" : "min-h-0",
  );

  if (media.status === "queued" || media.status === "rendering") {
    const ready = media.shots?.filter((s) => s.url).length ?? 0;
    const total = media.shots?.length ?? 0;
    return (
      <div className={cn(frame, "flex items-center gap-3 px-3 py-2.5")}>
        <Loader2 className="size-4 shrink-0 animate-spin text-indigo-glow" />
        <p className="text-sm text-fg">
          {media.kind === "video"
            ? total > 1
              ? `Rendering the ${media.duration ?? ""}s clip · shot ${Math.min(ready + 1, total)} of ${total}`
              : `Rendering the ${media.duration ?? ""}s clip…`
            : "Rendering the still…"}
        </p>
      </div>
    );
  }

  if (media.status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-elevated px-3 py-2.5 shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-warn-glow uppercase">RENDER PAUSED</p>
          <p className="mt-0.5 text-sm leading-snug text-fg">
            {media.error ?? "The clip could not finish. Retry to attach the file."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {onDismiss ? (
            <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss">
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!media.url && !media.shots?.some((s) => s.url)) return null;

  return (
    <div className={frame}>
      <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-2 py-1 backdrop-blur-sm">
        {media.kind === "video" ? (
          <Clapperboard className="size-3 text-emerald-glow" />
        ) : (
          <ImageIcon className="size-3 text-emerald-glow" />
        )}
        <span className="text-[10px] tracking-wider text-muted uppercase">
          {media.kind === "video" ? `${media.duration ?? 6}s clip` : "Still"}
        </span>
        <Badge variant="emerald">Product</Badge>
      </div>
      {media.kind === "video" ? (
        <ReelPlayer
          shots={media.shots}
          fallbackUrl={media.url}
          className={compact ? "max-h-64" : "max-h-[min(52vh,28rem)]"}
        />
      ) : (
        <img
          src={media.url}
          alt=""
          className={cn("w-full bg-bg object-contain", compact ? "max-h-64" : "max-h-[min(52vh,28rem)]")}
        />
      )}
      <div className="flex justify-end p-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => void download()}>
          <Download className="size-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}
