import { Markdown } from "@/lib/markdown";
import type { Branch, ChatMessage, PlanId, StudioMode, Verdict, WarningInfo } from "@/lib/types";
import { VIDEO_LENGTHS, VIDEO_LIMITS, type VideoLength } from "@/lib/video-plan";
import { canCiteSources } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductStage } from "@/components/studio/product-stage";
import {
  GitBranch,
  GitFork,
  Send,
  Square,
  Boxes,
  MessageSquareText,
  Download,
  Github,
  HardDrive,
  Plus,
  X,
  FileText,
  Clapperboard,
  Loader2,
} from "lucide-react";
import { starterPrompts } from "@/lib/starters";
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { UserFile } from "@/lib/user-files";
import { MAX_USER_FILES, readUserFiles } from "@/lib/user-files";
import { toast } from "sonner";

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: StudioMode;
  onChange: (m: StudioMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-elevated p-1 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
      <button
        type="button"
        onClick={() => onChange("talk")}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-[background-color,color] duration-150",
          mode === "talk" ? "bg-surface text-fg" : "text-muted hover:text-fg",
        )}
      >
        <MessageSquareText className="size-3.5" />
        Talk to Me
      </button>
      <button
        type="button"
        onClick={() => onChange("build")}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-[background-color,color] duration-150",
          mode === "build" ? "bg-surface text-fg" : "text-muted hover:text-fg",
        )}
      >
        <Boxes className="size-3.5" />
        Build Asset
      </button>
    </div>
  );
}

export function BranchBar({
  branches,
  activeId,
  onSelect,
}: {
  branches: Branch[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (branches.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <GitBranch className="size-3.5 shrink-0 text-muted" />
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.id)}
          className={cn(
            "h-8 shrink-0 rounded-full px-3 text-xs transition-[background-color,color] duration-150",
            b.id === activeId ? "bg-indigo/20 text-indigo-glow" : "text-muted hover:text-fg",
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function MessageList({
  messages,
  plan,
  streamingId,
  onFork,
  hideMediaId,
  onRetry,
}: {
  messages: ChatMessage[];
  plan: PlanId;
  streamingId?: string;
  onFork: (id: string) => void;
  hideMediaId?: string;
  onRetry?: () => void;
}) {
  const showSources = canCiteSources(plan);
  return (
    <div className="space-y-5">
      {messages.map((m, i) => (
        <article key={m.id} className="group min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
              {m.role === "user" ? "You" : "Studio"}
            </span>
            {m.role === "assistant" && m.deliverable && m.deliverable !== "text" ? (
              <Badge variant="indigo">{m.deliverable}</Badge>
            ) : null}
            {m.role === "assistant" && m.verdict === "WARN" ? (
              <Badge variant="warn">Flagged — not blocked</Badge>
            ) : null}
            {m.role === "assistant" && m.verdict === "PASS" ? (
              <Badge variant="emerald">Verified</Badge>
            ) : null}
            {streamingId === m.id ? <span className="shimmer-text text-[10px] uppercase">Streaming</span> : null}
            <button
              type="button"
              onClick={() => onFork(m.id)}
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-sm px-2 text-[11px] text-muted opacity-100 transition-[color,opacity] duration-150 hover:text-fg md:opacity-0 md:group-hover:opacity-100"
            >
              <GitFork className="size-3.5" />
              Fork
            </button>
          </div>
          {m.role === "assistant" && m.media && m.id !== hideMediaId ? (
            <div className="mb-2">
              <ProductStage media={m.media} compact />
            </div>
          ) : null}
          <div
            className={cn(
              "rounded-xl px-4 py-3",
              m.role === "user"
                ? "ml-4 bg-elevated shadow-[0_0_0_1px_rgb(255_255_255/0.05)] md:ml-16"
                : "mr-2 bg-panel shadow-[0_0_0_1px_rgb(255_255_255/0.06)] md:mr-8",
            )}
          >
            {m.role === "assistant" ? <Markdown text={m.content} /> : <p className="text-sm leading-relaxed">{m.content}</p>}
            {onRetry &&
            !streamingId &&
            i === messages.length - 1 &&
            m.role === "assistant" &&
            /tap retry|could not finish|could not complete/i.test(m.content) ? (
              <div className="mt-3">
                <Button size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
          {showSources && m.sources && m.sources.length > 0 ? (
            <ul className="mt-2 space-y-1 pl-1">
              {m.sources.map((s) => (
                <li key={s.url} className="text-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-glow underline decoration-emerald/30 underline-offset-2"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  mode,
  hint,
  onZip,
  onNetwork,
  onGithub,
  plan,
  duration,
  onDuration,
  showDuration,
  files = [],
  onFiles,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  mode: StudioMode;
  hint?: string;
  onZip: () => void;
  onNetwork: () => void;
  onGithub: () => void;
  plan?: PlanId;
  duration?: VideoLength;
  onDuration?: (n: VideoLength) => void;
  showDuration?: boolean;
  files?: UserFile[];
  onFiles?: (files: UserFile[]) => void;
}) {
  const lengths = plan ? VIDEO_LENGTHS[plan] : [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const busyRef = useRef(false);
  const locked = streaming || attachBusy;

  async function addFiles(list: FileList | File[] | null | undefined) {
    if (!onFiles) return;
    if (busyRef.current) {
      toast.message("Still attaching — wait for the current batch to finish.");
      return;
    }
    const incoming = list == null ? [] : [...list];
    if (!incoming.length) return;

    busyRef.current = true;
    setAttachBusy(true);
    try {
      const remaining = Math.max(0, MAX_USER_FILES - files.length);
      const { files: next, errors } = await readUserFiles(incoming, { remainingSlots: remaining });
      if (next.length) {
        onFiles([...files, ...next].slice(0, MAX_USER_FILES));
      }
      if (errors.length) {
        const head = errors[0] ?? "Could not attach that file.";
        if (!next.length) {
          toast.error(head);
          for (const msg of errors.slice(1, 3)) toast.error(msg);
        } else {
          toast.message(`${next.length} attached. ${errors.length} skipped.`);
          toast.error(head);
        }
      } else if (next.length) {
        toast.success(next.length === 1 ? "File attached." : `${next.length} files attached.`);
      }
    } catch {
      toast.error("Attach failed. Try JPG, PNG, WebP, or a smaller text/code file.");
    } finally {
      busyRef.current = false;
      setAttachBusy(false);
    }
  }

  return (
    <form
      className="glass rounded-2xl p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (attachBusy) return;
        if (streaming) onStop();
        else onSubmit();
      }}
    >
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.txt,.md,.json,.ts,.tsx,.js,.jsx,.css,.html,.svg,.csv"
        multiple
        disabled={attachBusy}
        suppressHydrationWarning
        onChange={(e) => {
          try {
            const picked = e.target.files;
            if (picked?.length) void addFiles(picked);
          } catch {
            toast.error("Could not open that selection. Try again from +.");
          } finally {
            e.target.value = "";
          }
        }}
      />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          mode === "build"
            ? "Describe the product — a full app, a still, or a clip. Tap + to lock a photo."
            : "Ask a question, request a still, or ask for a full running app. Tap + to attach a file."
        }
        rows={2}
        disabled={attachBusy}
        onKeyDown={(e) => {
          if (attachBusy) return;
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onPaste={(e) => {
          try {
            const pasted = [...e.clipboardData.files];
            if (pasted.length) {
              e.preventDefault();
              void addFiles(pasted);
            }
          } catch {
            toast.error("Paste attach failed. Use the + button instead.");
          }
        }}
        className="min-h-16 border-0 bg-transparent shadow-none focus:shadow-none disabled:opacity-60"
        suppressHydrationWarning
      />
      {files.length || attachBusy ? (
        <ul className="flex flex-wrap gap-1.5 px-1 pb-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-elevated py-1 pr-1 pl-1.5 text-[11px] text-fg"
            >
              {f.kind === "image" && f.dataUrl ? (
                <img src={f.dataUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : f.kind === "video" ? (
                <Clapperboard className="size-3.5 text-indigo-glow" />
              ) : (
                <FileText className="size-3.5 text-indigo-glow" />
              )}
              <span className="max-w-28 truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                disabled={attachBusy}
                className="grid size-6 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-40"
                onClick={() => onFiles?.(files.filter((x) => x.id !== f.id))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
          {attachBusy ? (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-indigo/15 px-2.5 py-1 text-[11px] text-indigo-glow">
              <Loader2 className="size-3.5 animate-spin" />
              Reading files…
            </li>
          ) : null}
        </ul>
      ) : null}
      {showDuration && plan && onDuration ? (
        <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
          <span className="text-[11px] text-subtle">Length</span>
          {lengths.map((n) => (
            <button
              key={n}
              type="button"
              disabled={attachBusy}
              onClick={() => onDuration(n)}
              className={cn(
                "h-8 rounded-full px-2.5 text-[11px] transition-[background-color,color] duration-150 disabled:opacity-40",
                duration === n ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {`${n}s`}
            </button>
          ))}
          <span className="text-[11px] text-subtle">{VIDEO_LIMITS[plan].included} included</span>
        </div>
      ) : null}
      <div className="flex items-center gap-1 px-1 pb-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Button
            type="button"
            variant="indigo"
            size="icon"
            className="size-11 shrink-0 rounded-full shadow-[0_0_0_1px_rgb(99_102_241/0.45),0_0_18px_rgb(99_102_241/0.28)]"
            aria-label="Attach image, video, or file"
            title="Attach file"
            disabled={attachBusy || files.length >= MAX_USER_FILES}
            onClick={() => {
              if (attachBusy) return;
              fileRef.current?.click();
            }}
          >
            {attachBusy ? <Loader2 className="animate-spin" /> : <Plus className="size-5" />}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onZip} aria-label="Export ZIP" disabled={attachBusy}>
            <Download />
            <span className="hidden sm:inline">ZIP</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onNetwork} aria-label="Sync network" disabled={attachBusy}>
            <HardDrive />
            <span className="hidden sm:inline">Sync</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onGithub} aria-label="Push GitHub" disabled={attachBusy}>
            <Github />
            <span className="hidden sm:inline">GitHub</span>
          </Button>
          {attachBusy ? (
            <span className="truncate text-[11px] text-indigo-glow">Attaching… Composer locked until batch settles.</span>
          ) : hint ? (
            <span className="hidden truncate text-[11px] text-subtle md:inline">{hint}</span>
          ) : null}
        </div>
        {streaming ? (
          <Button type="button" variant="danger" size="sm" onClick={onStop}>
            <Square className="size-3.5" />
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={locked || !value.trim()}>
            <Send className="size-3.5" />
            Send
          </Button>
        )}
      </div>
    </form>
  );
}

export function EmptyState({
  mode,
  onPrompt,
  compact = false,
}: {
  mode: StudioMode;
  onPrompt: (text: string) => void;
  compact?: boolean;
}) {
  const [prompts] = useState(() => starterPrompts(mode));

  return (
    <div className={cn("mx-auto flex max-w-xl flex-col items-start gap-4", compact ? "py-2" : "gap-5 py-4 md:py-8")}>
      {compact ? null : (
        <div className="stagger-in space-y-3">
          <Badge variant="indigo">Ask. Get the product.</Badge>
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-fg md:text-4xl">
            Four frontier agents. One brief. Elite output.
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted md:text-base">
            Claude, ChatGPT, Gemini, and Grok work one brief in lockstep and hand you a verified answer or a real,
            running React app. Expand a seat to pick its catalog model — the engine clamps every pick to your plan
            ceiling. A personal key changes who pays, not how high you can go.
          </p>
        </div>
      )}
      <ul className="flex w-full flex-col gap-2">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPrompt(p)}
              className="w-full rounded-xl bg-panel px-4 py-3 text-left text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.06)] transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1px_rgb(99_102_241/0.35)] active:scale-[0.99]"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerdictBanner({
  verdict,
  warning,
  onDismiss,
  onRetry,
}: {
  verdict: Verdict;
  warning?: WarningInfo;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (verdict !== "WARN") return null;
  return (
    <div className="rounded-xl bg-warn/10 px-3 py-3 shadow-[0_0_0_1px_rgb(245_158_11/0.28)]">
      <p className="text-xs font-medium tracking-wide text-warn-glow uppercase">Warning — answer kept</p>
      <p className="mt-1.5 text-sm leading-relaxed text-fg">
        {warning?.why ?? "Some claims could not be fully verified. The answer below is still shown."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        How to continue: {warning?.fix ?? "Dismiss and keep the answer, add sources in your next prompt, or run the mesh again."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Keep answer
        </Button>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Run again
        </Button>
      </div>
    </div>
  );
}
