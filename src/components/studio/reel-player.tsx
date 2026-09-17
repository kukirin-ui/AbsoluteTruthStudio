import { useEffect, useRef, useState } from "react";
import type { MediaShot } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReelPlayer({
  shots,
  fallbackUrl,
  className,
}: {
  shots?: MediaShot[];
  fallbackUrl?: string;
  className?: string;
}) {
  const list = shots?.filter((s) => s.url) ?? [];
  const srcs = list.length ? list : fallbackUrl ? [{ url: fallbackUrl, playSeconds: 0, apiDuration: 10 as const, prompt: "" }] : [];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const current = srcs[index];
  const total = list.reduce((n, s) => n + s.playSeconds, 0) || undefined;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !current) return;
    el.src = current.url;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }, [current?.url, index]);

  if (!current) return null;

  const prefix = list.slice(0, index).reduce((n, s) => n + s.playSeconds, 0);

  return (
    <div className={cn("relative bg-bg", className)}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        className="w-full bg-bg"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const cap = current.playSeconds || 0;
          setElapsed(prefix + t);
          if (cap && t >= cap - 0.05) {
            if (index + 1 < srcs.length) setIndex(index + 1);
            else {
              setIndex(0);
              setElapsed(0);
            }
          }
        }}
        onEnded={() => {
          if (index + 1 < srcs.length) setIndex(index + 1);
          else {
            setIndex(0);
            setElapsed(0);
          }
        }}
      />
      {total ? (
        <p className="absolute top-2 right-2 rounded-full bg-surface/85 px-2 py-1 font-mono text-[10px] text-muted tabular-nums backdrop-blur-sm">
          {elapsed.toFixed(1)}s / {total}s
        </p>
      ) : null}
    </div>
  );
}
