import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AgentMesh } from "@/components/studio/agent-mesh";
import { KiraWelcomeState, SovereignMeshField } from "@/components/studio/KiraWelcomeState";
import {
  AmbientGlow,
  BillingDrawer,
  HeaderBar,
  Library,
  NavDrawer,
} from "@/components/studio/chrome";
import {
  BranchBar,
  Composer,
  MessageList,
  ModeSwitch,
  VerdictBanner,
} from "@/components/studio/conversation-pane";
import { MemoryDrawer } from "@/components/studio/memory-drawer";
import { PluginDrawer } from "@/components/studio/plugin-drawer";
import { ProductStage } from "@/components/studio/product-stage";
import { Workbench } from "@/components/studio/workbench";
import { canCiteSources } from "@/lib/billing";
import { inferDeliverable, inferAspect } from "@/lib/deliverable";
import {
  copySharePayload,
  decompressParam,
  exportGithubBundle,
  exportNetworkBackup,
  exportZip,
  filesFromConversation,
} from "@/lib/export";
import { startImagine, waitForVideo } from "@/lib/imagine";
import { groundPrompt } from "@/lib/ground";
import { applyLock, heroStillPrompt, lockShotPrompt, type ProductLock } from "@/lib/product-lock";
import { hasReactApp } from "@/lib/app-runtime";
import { fallbackAppFiles, fallbackConsensus, productTitle } from "@/lib/fallback-app";
import { ByokSettingsDrawer } from "@/components/studio/byok-settings";
import { listByokCredentials, type ByokCredentialMeta } from "@/lib/byok";
import { fetchMeter, formatCreditCents } from "@/lib/meter-client";
import {
  isMeshPaymentRequiredError,
  parseMesh,
  streamMesh,
  tracesFromParsed,
  tracesIdle,
  tracesQueued,
  type MeshPaymentRequiredError,
} from "@/lib/mesh";
import {
  canRenderMedia,
  canRenderVideo,
  isPluginOwned,
  modelForPlan,
  planCoversModel,
  videoPluginId,
  videoQuotaLeft,
} from "@/lib/plugins";
import { activeBranch, activeConversation, effectivePlan, flushStudioPersist, pauseStudioPersist, resumeStudioPersist, useStudio } from "@/lib/store";
import type { AgentTrace, ChatMessage, DeliverableKind, MediaAsset, MediaShot, PlanId, StudioMode, Verdict, WarningInfo } from "@/lib/types";
import { uid } from "@/lib/utils";
import { clampVideoLength, inferVideoLength, planShots, VIDEO_LIMITS, type VideoLength } from "@/lib/video-plan";
import { catalogOwnKey, seatedItem, type CatalogItem } from "@/lib/catalog";
import { catalogProviderLabel, resolvedSeatModelId, userContextForPlan } from "@/lib/engine";
import { readOwner } from "@/lib/owner";
import { providerForAgentId } from "@/lib/providers";
import { filesBrief, imageRefs, type UserFile } from "@/lib/user-files";
import { lookPrefix } from "@/lib/economics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function StudioApp({
  shareParam,
  refCode,
  paidParam,
}: {
  shareParam?: string;
  refCode?: string;
  paidParam?: "pro" | "premium";
}) {
  const store = useStudio();
  const plan = effectivePlan(store);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<StudioMode>("talk");
  const [draft, setDraft] = useState("");
  const [clipLength, setClipLength] = useState<VideoLength>(10);
  const [userFiles, setUserFiles] = useState<UserFile[]>([]);
  const [codeOpen, setCodeOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  /** Live studio credit cents from GET /api/meter when Auth/session works. */
  const [liveCreditCents, setLiveCreditCents] = useState<number | null>(null);
  const [hasByok, setHasByok] = useState(false);
  /** When mesh returns 402 PAYMENT_REQUIRED — CTA strip (do not spoof credits). */
  const [paymentRequired, setPaymentRequired] = useState<{
    creditCents: number;
    hasByok: boolean;
  } | null>(null);
  const [focusPlugin, setFocusPlugin] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [liveId, setLiveId] = useState<string | undefined>();
  const [traces, setTraces] = useState<AgentTrace[]>(tracesIdle());
  const [verdict, setVerdict] = useState<Verdict>("PENDING");
  const [warning, setWarning] = useState<WarningInfo | undefined>();
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [capacityNote, setCapacityNote] = useState<string | null>(null);
  const lastPromptRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const convo = activeConversation(store);
  const branch = activeBranch(convo);
  const messages = branch?.messages ?? [];
  const files = useMemo(() => {
    const fromProject = store.projects.find((p) => p.conversationId === convo?.id);
    return fromProject?.files?.length ? fromProject.files : filesFromConversation(convo);
  }, [store.projects, convo]);

  const liveMedia = useMemo(() => {
    const fromMsg = [...messages].reverse().find((m) => m.media)?.media;
    const fromProject = store.projects.find((p) => p.conversationId === convo?.id)?.media;
    return fromMsg ?? fromProject;
  }, [messages, store.projects, convo?.id]);

  const draftKind = inferDeliverable(draft);

  useEffect(() => {
    const unsub = useStudio.persist.onFinishHydration(() => setHydrated(true));
    if (useStudio.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated || !shareParam) return;
    void (async () => {
      try {
        const json = await decompressParam(shareParam);
        const data = JSON.parse(json) as {
          conversation?: (typeof store.conversations)[number];
          project?: (typeof store.projects)[number];
        };
        if (data.conversation) {
          const exists = store.conversations.some((c) => c.id === data.conversation!.id);
          if (!exists) {
            useStudio.setState({
              conversations: [data.conversation, ...useStudio.getState().conversations],
              activeConversationId: data.conversation.id,
            });
          } else {
            store.setActiveConversation(data.conversation.id);
          }
          toast.success("Imported shared session");
        }
        if (data.project) {
          store.upsertProject(data.project);
        }
      } catch {
        toast.error("Share link could not be imported");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, shareParam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming]);

  useEffect(() => {
    if (!hydrated) return;
    if (plan === "pro" || plan === "premium") {
      store.clearFailedMedia();
    }
    if (paidParam === "pro" || paidParam === "premium") {
      store.setPlan(paidParam);
      store.clearFailedMedia();
      toast.success(`${paidParam === "pro" ? "Pro" : "Premium"} is active on this device.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, store.plan, paidParam]);

  useEffect(() => {
    setClipLength(VIDEO_LIMITS[plan].max === 5 ? 5 : Math.min(clipLength, VIDEO_LIMITS[plan].max) as VideoLength);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      const meter = await fetchMeter();
      if (cancelled) return;
      if (meter.ok) {
        setLiveCreditCents(meter.meter.creditCents);
        setHasByok(meter.meter.hasByok);
        return;
      }
      // Auth off / 401 / 503 — keep local mock credits; try BYOK list for badge only.
      const byok = await listByokCredentials();
      if (cancelled) return;
      if (byok.ok) {
        setHasByok(byok.credentials.length > 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  function resetMeshUi() {
    setTraces(tracesIdle());
    setVerdict("PENDING");
    setWarning(undefined);
    setCapacityNote(null);
  }

  function openPlugins(id?: string) {
    setFocusPlugin(id ?? null);
    setPluginsOpen(true);
  }

  function demandAppSeat(_nextMode: StudioMode, _intent: DeliverableKind) {
    return true;
  }

  function handleMode(next: StudioMode) {
    if (!demandAppSeat(next, "text")) return;
    setMode(next);
    setWorkbenchOpen(false);
    resetMeshUi();
    if (convo && convo.mode !== next) {
      // Closing the prior conversation is an explicit persist point.
      flushStudioPersist();
      store.setActiveConversation(null);
    }
  }

  function composerHint() {
    if (draftKind === "video") {
      if (plan === "free") return "Video starts on Pro";
      const left = videoQuotaLeft(plan, store.wallet);
      const visual = seatedItem(store.roster, "visual");
      return `${visual.name} · ${clipLength}s · ${left} included left`;
    }
    if (draftKind === "image") {
      const model = modelForPlan(plan, "imagine-image", store.wallet);
      if (model && planCoversModel(plan, model.id)) return "Still included";
      if (plan === "free") return "Included try · then Pro";
      return undefined;
    }
    if (draftKind === "app") return "Live React app";
    return undefined;
  }

  async function renderMedia(opts: {
    kind: "image" | "video";
    prompt: string;
    duration: number;
    aspect: "16:9" | "9:16" | "1:1";
    shotLines?: string[];
    lock?: ProductLock;
    refs?: UserFile[];
    conversationId: string;
    branchId: string;
    assistant: ChatMessage;
    signal: AbortSignal;
  }): Promise<MediaAsset> {
    const visual = seatedItem(store.roster, "visual");
    const pluginId =
      opts.kind === "video"
        ? visual.wire === "kling"
          ? videoPluginId(plan, store.wallet)
          : "imagine-video"
        : "imagine-image";
    const model = modelForPlan(plan, pluginId, store.wallet);
    if (!model) {
      return {
        kind: opts.kind,
        status: "failed",
        prompt: opts.prompt,
        pluginId,
        modelId: "",
        duration: opts.duration,
        aspect: opts.aspect,
        error: `${pluginId === "kling-video" ? "Kling" : "Imagine"} is not seated.`,
      };
    }

    if (opts.kind === "image") {
      const access = canRenderMedia(plan, store.wallet, model);
      if (!access.ok) {
        return {
          kind: "image",
          status: "failed",
          prompt: opts.prompt,
          pluginId,
          modelId: model.id,
          aspect: opts.aspect,
          error: "Included stills used. Pro includes Imagine stills.",
        };
      }
      const asset: MediaAsset = {
        kind: "image",
        status: "rendering",
        prompt: opts.prompt,
        pluginId,
        modelId: model.id,
        aspect: opts.aspect,
      };
      store.replaceMessage(opts.conversationId, opts.branchId, { ...opts.assistant, media: asset });
      const refs = imageRefs(opts.refs ?? []);
      const look = lookPrefix(visual.id);
      const stillPrompt = `${look ? look + " " : ""}${opts.lock ? applyLock(opts.prompt, opts.lock) : opts.prompt}`;
      const started = await startImagine({
        kind: "image",
        prompt: stillPrompt,
        model: model.apiModel,
        aspect: opts.aspect,
        image: refs[0],
        references: refs.slice(1),
        signal: opts.signal,
      });
      if (!started.ok) return { ...asset, status: "failed", error: started.error };
      if (started.kind === "image") {
        if (access.spend) store.spendCredits(model.id, access.cost);
        else if ("trial" in access && access.trial) store.markIncludedUsed();
        return { ...asset, status: "ready", url: started.url };
      }
      return { ...asset, status: "failed", error: "Unexpected render kind." };
    }

    const length = clampVideoLength(plan, opts.duration || clipLength);
    const access = canRenderVideo(plan, store.wallet, length, model);
    if (!access.ok) {
      const msg =
        access.reason === "plan"
          ? "Video starts on Pro. The four agents still structure the brief."
          : access.reason === "duration"
            ? `${plan === "pro" ? "Pro" : "Premium"} includes clips up to ${VIDEO_LIMITS[plan].max}s.`
            : `Included clips used (${VIDEO_LIMITS[plan].included}). Buy a credit pack for more.`;
      return {
        kind: "video",
        status: "failed",
        prompt: opts.prompt,
        pluginId,
        modelId: model.id,
        duration: length,
        aspect: opts.aspect,
        error: msg,
      };
    }

    const planned = planShots(length, opts.prompt, opts.shotLines).map((s, i, arr) => {
      const locked = opts.lock ? lockShotPrompt(opts.lock, s.prompt, i, arr.length) : s.prompt;
      const look = lookPrefix(visual.id);
      return { ...s, prompt: look ? `${look} ${locked}` : locked };
    });
    let asset: MediaAsset = {
      kind: "video",
      status: "rendering",
      prompt: opts.prompt,
      pluginId,
      modelId: model.id,
      duration: length,
      aspect: opts.aspect,
      shots: planned.map((s) => ({
        url: "",
        prompt: s.prompt,
        apiDuration: s.apiDuration,
        playSeconds: s.playSeconds,
      })),
    };
    store.replaceMessage(opts.conversationId, opts.branchId, { ...opts.assistant, media: asset });

    const refs = imageRefs(opts.refs ?? []);
    let hero = refs[0];
    if (!hero && opts.lock) {
      const plate = await startImagine({
        kind: "image",
        prompt: heroStillPrompt(opts.lock),
        model: "grok-imagine-image-quality",
        aspect: opts.aspect,
        signal: opts.signal,
      });
      if (plate.ok && plate.kind === "image") hero = plate.url;
    }

    const rendered: MediaShot[] = [];
    for (let i = 0; i < planned.length; i++) {
      const shot = planned[i]!;
      if (opts.signal.aborted) break;
      const started = await startImagine({
        kind: "video",
        prompt: shot.prompt,
        model: model.apiModel,
        duration: shot.apiDuration,
        aspect: opts.aspect,
        image: hero,
        references: refs.length ? refs : hero ? [hero] : undefined,
        signal: opts.signal,
      });
      if (!started.ok || started.kind !== "video") continue;
      const done = await waitForVideo(started.requestId, opts.signal);
      if (done.ok && done.status === "done" && done.url) {
        rendered.push({
          url: done.url,
          prompt: shot.prompt,
          apiDuration: shot.apiDuration,
          playSeconds: shot.playSeconds,
        });
        asset = { ...asset, shots: [...rendered] };
        store.replaceMessage(opts.conversationId, opts.branchId, { ...opts.assistant, media: asset });
      }
    }

    if (rendered.length === 0) {
      return { ...asset, status: "failed", error: "The clip could not finish. Retry to attach the file." };
    }
    if (access.spend && access.cost) store.spendCredits(model.id, access.cost);
    else store.markVideoUsed(plan);
    return {
      ...asset,
      status: "ready",
      url: rendered[0]!.url,
      shots: rendered,
      duration: rendered.reduce((n, s) => n + s.playSeconds, 0),
    };
  }

  async function runPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const intent = inferDeliverable(trimmed);
    if (!demandAppSeat(mode, intent)) return;
    const explicit = trimmed.match(/\b(5|10|15|20|30|45|60)\s*-?\s*(s|sec|sek)/i);
    const videoLen: VideoLength = explicit
      ? clampVideoLength(plan, Number(explicit[1]))
      : clipLength;

    lastPromptRef.current = trimmed;
    setCapacityNote(null);
    setPaymentRequired(null);
    setWarning(undefined);

    let current = convo;
    if (!current || current.mode !== mode) {
      current = store.newConversation(mode);
    }
    const conversationId = current.id;
    const branchId = current.activeBranchId;
    const brief = filesBrief(userFiles);
    const meshText = brief ? `${trimmed}\n\n${brief}` : trimmed;
    const history = (activeBranch(current)?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    store.appendMessage(conversationId, branchId, userMsg);

    const assistantId = uid("msg");
    const assistant: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      agents: tracesQueued(),
      verdict: "PENDING",
      deliverable: intent,
      createdAt: Date.now(),
    };
    store.appendMessage(conversationId, branchId, assistant);
    setDraft("");
    setStreaming(true);
    setLiveId(assistantId);
    setTraces(tracesQueued());
    setVerdict("PENDING");
    if (intent === "app") {
      setWorkbenchOpen(true);
    } else {
      setWorkbenchOpen(false);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let lock: ProductLock | undefined;

    try {
      pauseStudioPersist();
      lock = intent === "image" || intent === "video" ? await groundPrompt(trimmed, intent) : undefined;
      const mediaTask =
        intent === "image" || intent === "video"
          ? renderMedia({
              kind: intent,
              prompt: trimmed,
              duration: intent === "video" ? videoLen : 6,
              aspect: inferAspect(trimmed),
              shotLines: lock?.shots,
              lock,
              refs: userFiles,
              conversationId,
              branchId,
              assistant: {
                ...assistant,
                content: intent === "video" ? "Rendering the clip…" : "Rendering the still…",
                agents: tracesQueued(),
                verdict: "PENDING",
                deliverable: intent,
              },
              signal: controller.signal,
            })
          : null;

      let last = "";
      let lastParse = 0;
      let streamError: Error | null = null;
      const meshAttempts = mediaTask ? 1 : 2;
      for (let attempt = 0; attempt < meshAttempts; attempt++) {
        last = "";
        lastParse = 0;
        try {
          for await (const acc of streamMesh(
            {
              mode: intent === "text" ? mode : "build",
              plan,
              intent,
              duration: intent === "video" ? videoLen : undefined,
              specCompiler: isPluginOwned(store.wallet, "spec-compiler", plan),
              deepAudit: isPluginOwned(store.wallet, "deep-audit", plan),
              memory: store.memory,
              roster: store.roster,
              attachments: store.attachments,
              tier: store.seatTier.architect ?? undefined,
              model: resolvedSeatModelId(
                store.seatModel.architect,
                store.seatTier.architect,
                userContextForPlan(plan, readOwner()),
                catalogProviderLabel(providerForAgentId(seatedItem(store.roster, "architect").id)),
              ),
              power: store.power,
              activeSeats: store.activeSeats,
              messages: [...history, { role: "user", content: meshText }],
            },
            controller.signal,
          )) {
            last = acc;
            const now = Date.now();
            if (now - lastParse < 90 && !acc.includes("<<<CONSENSUS>>>")) continue;
            lastParse = now;
            const parsed = parseMesh(acc, trimmed, plan);
            const nextTraces = tracesFromParsed(parsed, true);
            setTraces(nextTraces);
            setVerdict(parsed.verdict);
            setWarning(parsed.warning);
            const kind = parsed.spec.deliverable !== "text" ? parsed.spec.deliverable : intent;
            store.replaceMessage(conversationId, branchId, {
              ...assistant,
              content: parsed.consensus || (parsed.active ? "" : acc),
              agents: nextTraces,
              sources: canCiteSources(plan) ? parsed.sources : [],
              files:
                kind === "app"
                  ? parsed.files
                  : parsed.files.filter((f: { language: string; path: string }) => f.language === "html" || f.path.endsWith(".html")),
              verdict: parsed.verdict,
              warning: parsed.warning,
              deliverable: kind,
            });
          }
          streamError = null;
          break;
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          streamError = err instanceof Error ? err : new Error("Mesh failed");
          // Do not retry unpaid hard-stop — credits/BYOK will not change mid-loop.
          if (isMeshPaymentRequiredError(err)) break;
        }
      }
      if (!last && streamError && !mediaTask) throw streamError;

      const parsed = parseMesh(last, trimmed, plan);
      const nextTraces = tracesFromParsed(parsed, false);
      setTraces(nextTraces);
      const finalVerdict = parsed.verdict === "PENDING" ? "PASS" : parsed.verdict;
      setVerdict(finalVerdict);
      setWarning(parsed.warning);
      const deliverable =
        parsed.spec.deliverable !== "text" ? parsed.spec.deliverable : intent;

      let finalFiles =
        deliverable === "app"
          ? parsed.files
          : parsed.files.filter((f) => f.language === "html" || f.path.endsWith(".html"));
      let consensus = parsed.consensus || last.trim();
      if (deliverable === "app" && !hasReactApp(finalFiles)) {
        finalFiles = fallbackAppFiles(trimmed);
        consensus = fallbackConsensus(productTitle(trimmed));
        setWorkbenchOpen(true);
      } else if (deliverable === "app") {
        setWorkbenchOpen(true);
      }

      let media: MediaAsset | undefined = mediaTask ? await mediaTask : undefined;
      if (!media && (deliverable === "image" || deliverable === "video")) {
        media = await renderMedia({
          kind: deliverable,
          prompt: parsed.spec.prompt || trimmed,
          duration: deliverable === "video" ? videoLen : parsed.spec.duration,
          aspect: parsed.spec.aspect,
          shotLines: parsed.spec.shots.length ? parsed.spec.shots : lock?.shots,
          lock,
          refs: userFiles,
          conversationId,
          branchId,
          assistant: {
            ...assistant,
            content: consensus,
            agents: nextTraces,
            sources: canCiteSources(plan) ? parsed.sources : [],
            files: finalFiles,
            verdict: finalVerdict,
            warning: parsed.warning,
            deliverable,
          },
          signal: controller.signal,
        });
      }
      if (media?.status === "ready") {
        setCapacityNote(null);
        toast.success(deliverable === "video" || intent === "video" ? "Clip is ready" : "Still is ready");
        if (!consensus) {
          consensus =
            intent === "video" || deliverable === "video"
              ? "The clip is on the stage. Play it, download it, or send a tighter brief."
              : "The still is on the stage. Download it or send a tighter brief.";
        }
      } else if (media?.status === "failed" && media.error) {
        setCapacityNote(media.error);
      }

      store.replaceMessage(conversationId, branchId, {
        ...assistant,
        content: consensus,
        agents: nextTraces,
        sources: canCiteSources(plan) ? parsed.sources : [],
        files: finalFiles,
        media,
        verdict: finalVerdict,
        warning: parsed.warning,
        deliverable,
      });
      if (finalFiles.length > 0 || media) {
        const title =
          useStudio.getState().conversations.find((c) => c.id === conversationId)?.title ?? "Asset";
        const project = store.upsertProject({
          id: store.projects.find((p) => p.conversationId === conversationId)?.id,
          title,
          conversationId,
          files: finalFiles,
          media,
        });
        if (media) store.updateProjectMedia(project.id, media);
        if (deliverable === "app") toast.success("App is running");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        toast.message("Stream stopped");
      } else if (intent === "app") {
        const files = fallbackAppFiles(trimmed);
        const consensus = fallbackConsensus(productTitle(trimmed));
        store.replaceMessage(conversationId, branchId, {
          ...assistant,
          content: consensus,
          agents: tracesIdle(),
          files,
          verdict: "PASS",
          deliverable: "app",
        });
        store.upsertProject({
          id: store.projects.find((p) => p.conversationId === conversationId)?.id,
          title: productTitle(trimmed),
          conversationId,
          files,
        });
        setWorkbenchOpen(true);
        setTraces(tracesIdle());
        setVerdict("PASS");
        toast.success("App is running");
      } else if (intent === "image" || intent === "video") {
        const idle = tracesIdle();
        setTraces(idle);
        setVerdict("PASS");
        setCapacityNote(null);
        try {
          const media = await renderMedia({
            kind: intent,
            prompt: trimmed,
            duration: intent === "video" ? videoLen : 6,
            aspect: inferAspect(trimmed),
            shotLines: lock?.shots,
            lock,
            refs: userFiles,
            conversationId,
            branchId,
            assistant: {
              ...assistant,
              content: intent === "video" ? "Rendering the clip…" : "Rendering the still…",
              agents: idle,
              verdict: "PASS",
              deliverable: intent,
            },
            signal: controller.signal,
          });
          const ready = media.status === "ready";
          const consensus = ready
            ? intent === "video"
              ? "The clip is on the stage. Play it, download it, or send a tighter brief."
              : "The still is on the stage. Download it or send a tighter brief."
            : media.error ?? "The render is still trying. Tap Retry if the file is not on the stage.";
          store.replaceMessage(conversationId, branchId, {
            ...assistant,
            content: consensus,
            agents: idle,
            media,
            verdict: ready ? "PASS" : "WARN",
            deliverable: intent,
          });
          const title =
            useStudio.getState().conversations.find((c) => c.id === conversationId)?.title ??
            (intent === "video" ? "Clip" : "Still");
          const project = store.upsertProject({
            id: store.projects.find((p) => p.conversationId === conversationId)?.id,
            title,
            conversationId,
            files: [],
            media,
          });
          store.updateProjectMedia(project.id, media);
          if (ready) toast.success(intent === "video" ? "Clip is ready" : "Still is ready");
          else if (media.error) setCapacityNote(media.error);
        } catch (renderErr) {
          if ((renderErr as Error).name === "AbortError") {
            toast.message("Stream stopped");
          } else {
            const message = renderErr instanceof Error ? renderErr.message : "Could not finish this turn";
            setCapacityNote(message);
            store.replaceMessage(conversationId, branchId, {
              ...assistant,
              content: "Could not finish this turn. Your prompt is saved — tap Retry.",
              agents: tracesIdle(),
              verdict: "PENDING",
              deliverable: intent,
            });
          }
        }
      } else if (isMeshPaymentRequiredError(err)) {
        const pay = err as MeshPaymentRequiredError;
        setPaymentRequired({ creditCents: pay.creditCents, hasByok: pay.hasByok });
        setLiveCreditCents(pay.creditCents);
        setHasByok(pay.hasByok);
        const message =
          pay.message ||
          "This run needs funding. Connect your own provider key (BYOK) to run on your own account, or upgrade your plan.";
        setCapacityNote(message);
        toast.error(message, {
          duration: 14000,
          action: {
            label: "Connect a key",
            onClick: () => setByokOpen(true),
          },
        });
        store.replaceMessage(conversationId, branchId, {
          ...assistant,
          content:
            "This run needs funding. Your prompt is saved — connect a BYOK key (or upgrade your plan), then Retry.",
          agents: tracesIdle(),
          verdict: "PENDING",
        });
        setTraces(tracesIdle());
        setVerdict("PENDING");
        setWarning(undefined);
      } else {
        const message = err instanceof Error ? err.message : "Could not finish this turn";
        setPaymentRequired(null);
        setCapacityNote(message);
        toast.error(message);
        store.replaceMessage(conversationId, branchId, {
          ...assistant,
          content: "Could not finish this turn. Your prompt is saved — tap Retry.",
          agents: tracesIdle(),
          verdict: "PENDING",
        });
        setTraces(tracesIdle());
        setVerdict("PENDING");
        setWarning(undefined);
      }
    } finally {
      resumeStudioPersist();
      setStreaming(false);
      setLiveId(undefined);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function shareChat(id: string) {
    const c = store.conversations.find((x) => x.id === id);
    if (!c) return;
    try {
      await copySharePayload({ conversation: c });
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy share link");
    }
  }

  async function shareProject(id: string) {
    const p = store.projects.find((x) => x.id === id);
    if (!p) return;
    try {
      await copySharePayload({ project: p });
      toast.success("Project share link copied");
    } catch {
      toast.error("Could not copy share link");
    }
  }

  function exportCurrent(kind: "zip" | "github" | "network") {
    if (kind === "network") {
      exportNetworkBackup({
        conversations: store.conversations,
        projects: store.projects,
      });
      void copySharePayload({
        conversations: store.conversations,
        projects: store.projects,
      })
        .then(() => toast.success("Backup downloaded and share snapshot copied"))
        .catch(() => toast.success("Backup downloaded"));
      return;
    }
    const title = convo?.title ?? "absolute-truth";
    const payload = {
      title,
      files: files.length
        ? files
        : [
            {
              path: "TRANSCRIPT.md",
              language: "md",
              content: messages.map((m) => `## ${m.role}\n${m.content}`).join("\n\n"),
            },
          ],
      conversation: convo,
    };
    if (kind === "zip") {
      exportZip(payload);
      toast.success("ZIP ready");
    } else {
      exportGithubBundle(payload);
      toast.success("GitHub bundle downloaded — unzip and push with gh repo create");
    }
  }

  const library = (
    <Library
      conversations={store.conversations}
      projects={store.projects}
      activeId={store.activeConversationId}
      onNew={() => {
        store.newConversation(mode);
        resetMeshUi();
        flushStudioPersist();
      }}
      onSelectChat={(id) => {
        if (store.activeConversationId && store.activeConversationId !== id) {
          flushStudioPersist();
        }
        store.setActiveConversation(id);
        const c = store.conversations.find((x) => x.id === id);
        if (c) setMode(c.mode);
        resetMeshUi();
      }}
      onSelectProject={(id) => {
        const p = store.projects.find((x) => x.id === id);
        if (p) {
          flushStudioPersist();
          store.setActiveConversation(p.conversationId);
          setMode("build");
          setWorkbenchOpen(true);
        }
        resetMeshUi();
      }}
      onDeleteChat={(id) => {
        store.deleteConversation(id);
        flushStudioPersist();
      }}
      onDeleteProject={(id) => {
        store.deleteProject(id);
        flushStudioPersist();
      }}
      onShareChat={shareChat}
      onShareProject={shareProject}
    />
  );

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-fg">
      <AmbientGlow />
      <HeaderBar
        plan={plan}
        creditsRemaining={
          liveCreditCents != null
            ? formatCreditCents(liveCreditCents)
            : Object.values(store.wallet.credits).reduce((n, v) => n + (v ?? 0), 0)
        }
        hasByok={hasByok}
        onOpenPlans={() => setBillingOpen(true)}
        onOpenByok={() => setByokOpen(true)}
        onOpenPlugins={() => openPlugins()}
        onOpenMemory={() => setMemoryOpen(true)}
        leftSlot={<NavDrawer>{library}</NavDrawer>}
      />

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border p-4 lg:block">
          <ScrollArea className="h-full pr-2">{library}</ScrollArea>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative z-20 flex shrink-0 flex-wrap items-center gap-2 bg-bg/55 px-3 py-2 backdrop-blur-md md:px-5">
            <ModeSwitch mode={mode} onChange={handleMode} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                flushStudioPersist();
                toast.success("Saved on this device.");
              }}
            >
              Save
            </Button>
            <BranchBar
              branches={convo?.branches ?? []}
              activeId={convo?.activeBranchId ?? "main"}
              onSelect={(id) => convo && store.setActiveBranch(convo.id, id)}
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCodeOpen(true)}
                className="h-9 rounded-md px-3 text-xs text-muted transition-[color] duration-150 hover:text-fg"
                aria-label="See Code — full generated sources"
              >
                See Code
                {files.length > 0 ? (
                  <span className="ml-1 font-mono text-[10px] text-indigo-glow tabular-nums">{files.length}</span>
                ) : null}
              </button>
              {hasReactApp(files) ? (
                <button
                  type="button"
                  onClick={() => setWorkbenchOpen((v) => !v)}
                  className="h-9 rounded-md px-3 text-xs text-muted transition-[color] duration-150 hover:text-fg"
                >
                  {workbenchOpen ? "Hide app" : "Show app"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            {messages.length === 0 ? <SovereignMeshField /> : null}
            <div className="touch-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-3 md:px-5">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 py-2 pb-6">
                <AgentMesh
                  traces={traces}
                  streaming={streaming}
                  verdict={verdict}
                  compact={messages.length > 0}
                  roster={store.roster}
                  attachments={store.attachments}
                  plan={plan}
                  wallet={store.wallet}
                  seatTier={store.seatTier}
                  seatModel={store.seatModel}
                  activeSeats={store.activeSeats}
                  power={store.power}
                  hasByok={hasByok}
                  onSeatModel={(seat, modelId) => store.setSeatModel(seat, modelId)}
                  onRequestByok={() => setByokOpen(true)}
                  onToggleSeat={(seat) => store.toggleSeatActive(seat)}
                  onPower={(p) => store.setPower(p)}
                  renderPaused={liveMedia?.status === "failed"}
                  onSeat={(seat, id) => {
                    const ok = store.setSeat(seat, id);
                    if (!ok) toast.error("Unlock this agent in Plugins first.");
                    return ok;
                  }}
                  onAttach={(seat, id) => {
                    const ok = store.toggleAttachment(seat, id);
                    if (!ok) toast.error("Unlock this tool in Plugins first.");
                    return ok;
                  }}
                  onUnlock={(item: CatalogItem) => {
                    setFocusPlugin(item.pluginId ?? item.id);
                    setPluginsOpen(true);
                    toast.message(`${item.name} is paid — integrate it, then seat it.`);
                  }}
                />
                {verdict === "WARN" ? (
                  <VerdictBanner
                    verdict={verdict}
                    warning={warning}
                    onDismiss={() => {
                      setVerdict("PENDING");
                      setWarning(undefined);
                    }}
                    onRetry={() => {
                      const p = lastPromptRef.current;
                      if (p) void runPrompt(p);
                    }}
                  />
                ) : null}
                {capacityNote ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-elevated px-3 py-2.5 shadow-[0_0_0_1px_rgb(255_255_255/0.08)] sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium tracking-wide text-muted uppercase">
                        {paymentRequired ? "Payment required" : "Mesh capacity"}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-fg">{capacityNote}</p>
                      {paymentRequired ? (
                        <p className="mt-1 text-[11px] text-subtle">
                          Credits: {formatCreditCents(paymentRequired.creditCents)}
                          {paymentRequired.hasByok ? " · BYOK on file" : " · no BYOK key"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {paymentRequired ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setBillingOpen(true);
                            }}
                          >
                            Buy credits
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setByokOpen(true)}
                          >
                            BYOK settings
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            const p = lastPromptRef.current;
                            if (p) void runPrompt(p);
                          }}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCapacityNote(null);
                          setPaymentRequired(null);
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ) : null}

                {liveMedia ? (
                  <ProductStage
                    media={liveMedia}
                    onDismiss={() => store.clearFailedMedia()}
                    onRetry={() => {
                      const p = lastPromptRef.current;
                      if (p) void runPrompt(p);
                    }}
                  />
                ) : null}

                {messages.length === 0 ? (
                  <KiraWelcomeState />
                ) : (
                  <MessageList
                    messages={messages}
                    plan={plan}
                    streamingId={liveId}
                    hideMediaId={[...messages].reverse().find((m) => m.media)?.id}
                    onFork={(id) => {
                      if (!convo) return;
                      const bid = store.forkBranch(convo.id, id);
                      if (bid) toast.success("Forked a new execution path");
                    }}
                    onRetry={() => {
                      const p = lastPromptRef.current;
                      if (p) void runPrompt(p);
                    }}
                  />
                )}

                {workbenchOpen && hasReactApp(files) ? (
                  <div className="min-h-72 overflow-hidden md:min-h-96">
                    <Workbench
                      files={files}
                      plan={plan}
                      wallet={store.wallet}
                      ready={!streaming}
                      onUpgrade={() => openPlugins("live-source")}
                      onChangeFile={(path, content) => {
                        const project = store.projects.find((p) => p.conversationId === convo?.id);
                        if (!project) return;
                        store.updateProjectFiles(
                          project.id,
                          project.files.map((f) => (f.path === path ? { ...f, content } : f)),
                        );
                      }}
                    />
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-5xl shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
              <Composer
                value={draft}
                onChange={(v) => {
                  setDraft(v);
                  if (inferDeliverable(v) === "video") {
                    const explicit = v.match(/\b(5|10|15|20|30|45|60)\s*-?\s*(s|sec|sek)/i);
                    if (explicit) setClipLength(clampVideoLength(plan, Number(explicit[1])));
                  }
                }}
                onSubmit={() => void runPrompt(draft)}
                onStop={stop}
                streaming={streaming}
                mode={mode}
                hint={composerHint()}
                onZip={() => exportCurrent("zip")}
                onNetwork={() => exportCurrent("network")}
                onGithub={() => exportCurrent("github")}
                plan={plan}
                duration={clipLength}
                onDuration={setClipLength}
                showDuration={draftKind === "video"}
                files={userFiles}
                onFiles={setUserFiles}
              />
            </div>
          </div>
        </main>
      </div>

      <ByokSettingsDrawer
        open={byokOpen}
        onOpenChange={setByokOpen}
        onCredentialsChange={(credentials: ByokCredentialMeta[]) => {
          setHasByok(credentials.length > 0);
        }}
      />
      <BillingDrawer
        open={billingOpen}
        onOpenChange={setBillingOpen}
        plan={plan}
        onGrant={(next: PlanId) => {
          store.setPlan(next);
          store.clearFailedMedia();
        }}
      />
      <PluginDrawer
        open={pluginsOpen}
        onOpenChange={setPluginsOpen}
        plan={plan}
        wallet={store.wallet}
        roster={store.roster}
        attachments={store.attachments}
        focusId={focusPlugin}
        onOwn={store.ownPlugin}
        onCredits={store.addCredits}
        onPrefer={store.setPreferredModel}
        onSeat={(seat, id) => store.setSeat(seat, id)}
        onAttach={(seat, id) => store.toggleAttachment(seat, id)}
      />
      <MemoryDrawer
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        memory={store.memory}
        onChange={store.setMemory}
      />
      <Sheet open={codeOpen} onOpenChange={setCodeOpen}>
        <SheetContent side="right" title="See Code" className="left-auto right-0 w-[min(100%,40rem)]">
          {files.length === 0 ? (
            <p className="text-sm text-muted">
              Build Asset sources appear here untruncated. Run a build that ships modules, then reopen See Code.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Full untruncated sources ({files.length} file{files.length === 1 ? "" : "s"}). Edit in the workbench
                on Premium / Live Source.
              </p>
              {files.map((f) => (
                <article key={f.path}>
                  <p className="mb-1 font-mono text-[11px] text-indigo-glow">
                    {f.path}
                    <span className="ml-2 text-subtle tabular-nums">{f.content.length.toLocaleString()} chars</span>
                  </p>
                  <pre className="max-h-[min(70dvh,36rem)] overflow-auto rounded-xl bg-elevated p-3 font-mono text-[11px] leading-relaxed whitespace-pre text-fg">
                    {f.content}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {!hydrated ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-bg">
          <p className="shimmer-text font-display text-lg">Restoring local state</p>
        </div>
      ) : null}
    </div>
  );
}
