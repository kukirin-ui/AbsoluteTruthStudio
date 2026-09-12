import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlanId, ProjectFile } from "@/lib/types";
import type { PluginWallet } from "@/lib/plugins";
import { canEditSource } from "@/lib/plugins";
import { buildAppRuntimeHtml, hasReactApp } from "@/lib/app-runtime";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, MonitorSmartphone } from "lucide-react";

export function Workbench({
  files,
  plan,
  wallet,
  ready = true,
  onChangeFile,
  onUpgrade,
}: {
  files: ProjectFile[];
  plan: PlanId;
  wallet: PluginWallet;
  ready?: boolean;
  onChangeFile: (path: string, content: string) => void;
  onUpgrade: () => void;
}) {
  const [active, setActive] = useState(files[0]?.path ?? "");
  const [showPreview, setShowPreview] = useState(true);
  const current = files.find((f) => f.path === active) ?? files[0];
  const previewHtml = useMemo(() => buildPreviewHtml(files), [files]);
  const editCode = canEditSource(plan, wallet);
  const reactApp = hasReactApp(files);

  if (files.length === 0) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-xl bg-panel px-6 text-center shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
        <p className="max-w-sm text-sm text-muted">
          Ask for an app and the live React product appears here — screens, frontend, and a working mock backend.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="emerald">{reactApp ? "Live app" : "Live product"}</Badge>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setActive(f.path)}
              className={cn(
                "h-8 shrink-0 rounded-sm px-2.5 font-mono text-[11px] transition-[background-color,color] duration-150",
                (current?.path ?? "") === f.path ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {f.path}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)} className="shrink-0">
          {showPreview ? <EyeOff /> : <Eye />}
          {showPreview ? "Hide preview" : "Show preview"}
        </Button>
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-2", showPreview ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showPreview ? (
          <div className="relative min-h-56 overflow-hidden rounded-xl bg-bg shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
            <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2 py-1 text-[10px] tracking-wider text-muted uppercase backdrop-blur-sm">
              <MonitorSmartphone className="size-3" />
              {reactApp ? "App" : "Preview"}
            </div>
            {ready ? (
              <iframe
                title="App preview"
                sandbox="allow-scripts allow-same-origin"
                className="h-full min-h-72 w-full bg-bg md:min-h-80"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="grid min-h-72 place-items-center px-6 text-center md:min-h-80">
                <p className="text-sm text-muted">Assembling the app…</p>
              </div>
            )}
          </div>
        ) : null}

        <div className="relative min-h-56 overflow-hidden rounded-xl bg-panel shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          {!editCode ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="absolute top-2 right-2 z-10 rounded-full bg-surface/80 px-2 py-1 text-[10px] tracking-wider text-muted uppercase backdrop-blur-sm hover:text-fg"
            >
              Read only · unlock edit
            </button>
          ) : null}
          <label className="sr-only" htmlFor="code-editor">
            Source
          </label>
          <textarea
            id="code-editor"
            value={current?.content ?? ""}
            onChange={(e) => {
              if (!editCode || !current) return;
              onChangeFile(current.path, e.target.value);
            }}
            readOnly={!editCode}
            spellCheck={false}
            className="h-full min-h-56 w-full resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-fg outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function buildPreviewHtml(files: ProjectFile[]) {
  if (hasReactApp(files)) return buildAppRuntimeHtml(files);
  const htmlFile = files.find((f) => f.language === "html" || f.path.endsWith(".html"));
  if (htmlFile?.content) return enhancePreviewHtml(htmlFile.content);
  return buildAppRuntimeHtml(files);
}

function enhancePreviewHtml(html: string) {
  const booster = `<script>
(function(){
  function kick(){
    document.querySelectorAll("video,audio").forEach(function(m){
      m.muted = true;
      m.playsInline = true;
      m.autoplay = true;
      try { m.play(); } catch (e) {}
    });
    document.querySelectorAll("button,[role=button],.play,#play").forEach(function(b){
      var t = ((b.textContent || b.getAttribute("aria-label") || "") + "").toLowerCase();
      if (/play|start|watch|go/.test(t)) { try { b.click(); } catch (e) {} }
    });
  }
  if (document.readyState === "complete") kick();
  else window.addEventListener("load", kick);
  setTimeout(kick, 200);
  setTimeout(kick, 800);
})();
</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, booster + "</body>");
  return html + booster;
}
