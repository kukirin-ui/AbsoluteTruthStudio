export type PlanId = "free" | "pro" | "premium";
export type StudioMode = "talk" | "build";
export type AgentId = "architect" | "visual" | "coder" | "security";
export type AgentStatus = "idle" | "queued" | "streaming" | "verified" | "flagged" | "render_paused";
export type Verdict = "PASS" | "WARN" | "PENDING";
export type DeliverableKind = "text" | "image" | "video" | "app";

export const AGENTS: {
  id: AgentId;
  brand: string;
  label: string;
  role: string;
}[] = [
  {
    id: "architect",
    brand: "Claude",
    label: "Architecture",
    role: "Structures constraints & sequence",
  },
  {
    id: "visual",
    brand: "Imagine",
    label: "Visual/UI",
    role: "Frames, stills & motion brief",
  },
  {
    id: "coder",
    brand: "ChatGPT",
    label: "Coder",
    role: "Ships running React modules",
  },
  {
    id: "security",
    brand: "Grok",
    label: "Verifier/Security",
    role: "Fact-check & verdict",
  },
];

export type SourceLink = {
  title: string;
  url: string;
};

export type ProjectFile = {
  path: string;
  language: string;
  content: string;
};

export type WarningInfo = {
  why: string;
  fix: string;
};

export type AgentTrace = {
  id: AgentId;
  status: AgentStatus;
  content: string;
};

export type MediaShot = {
  url: string;
  prompt: string;
  apiDuration: 6 | 10;
  playSeconds: number;
};

export type MediaAsset = {
  kind: "image" | "video";
  status: "queued" | "rendering" | "ready" | "failed";
  prompt: string;
  pluginId: string;
  modelId: string;
  url?: string;
  poster?: string;
  duration?: number;
  shots?: MediaShot[];
  aspect?: string;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agents?: AgentTrace[];
  sources?: SourceLink[];
  files?: ProjectFile[];
  media?: MediaAsset;
  deliverable?: DeliverableKind;
  verdict?: Verdict;
  warning?: WarningInfo;
  createdAt: number;
};

export type Branch = {
  id: string;
  label: string;
  parentBranchId: string | null;
  forkFromMessageId: string | null;
  messages: ChatMessage[];
};

export type Conversation = {
  id: string;
  title: string;
  mode: StudioMode;
  activeBranchId: string;
  branches: Branch[];
  createdAt: number;
  updatedAt: number;
};

export type SavedProject = {
  id: string;
  title: string;
  conversationId: string;
  files: ProjectFile[];
  media?: MediaAsset;
  createdAt: number;
  updatedAt: number;
};

export type AgentMemory = Record<AgentId, string>;

export const EMPTY_MEMORY: AgentMemory = {
  architect: "",
  visual: "",
  coder: "",
  security: "",
};

export type Entitlement = {
  proUntil?: number;
  foundingUntil?: number;
  founding?: boolean;
};

export type VisualSpec = {
  deliverable: DeliverableKind;
  prompt: string;
  duration: number;
  aspect: "16:9" | "9:16" | "1:1";
  shots: string[];
};
