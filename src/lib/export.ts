import type { Conversation, SavedProject, ProjectFile } from "./types";
import { buildZip, downloadBlob, type ZipEntry } from "./zip";

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "absolute-truth"
  );
}

export function filesFromConversation(convo: Conversation | undefined): ProjectFile[] {
  if (!convo) return [];
  const branch = convo.branches.find((b) => b.id === convo.activeBranchId);
  const last = [...(branch?.messages ?? [])].reverse().find((m) => (m.files?.length ?? 0) > 0);
  return last?.files ?? [];
}

function zipEntriesFor(title: string, files: ProjectFile[], convo?: Conversation): ZipEntry[] {
  const entries: ZipEntry[] = files.map((f) => ({ path: f.path, content: f.content }));
  if (convo) {
    const branch = convo.branches.find((b) => b.id === convo.activeBranchId);
    const transcript = (branch?.messages ?? [])
      .map((m) => `## ${m.role}\n\n${m.content}`)
      .join("\n\n---\n\n");
    entries.push({ path: "TRANSCRIPT.md", content: `# ${convo.title}\n\n${transcript}\n` });
  }
  const hasReadme = entries.some((e) => e.path.toLowerCase() === "readme.md");
  if (!hasReadme) {
    entries.push({
      path: "README.md",
      content: `# ${title}

Exported from Absolute Truth Studio.

All data was stored on-device. This archive is a one-click snapshot of the verified asset.

## Stack
- React + TypeScript + Tailwind CSS
- Generated via the 4-agent mesh (Claude Architect, Imagine Visual, ChatGPT Coder, Grok Verifier)

## Run locally
Open \`index.html\` or drop the React files into a Vite app.
`,
    });
  }
  return entries;
}

export function exportZip(opts: { title: string; files: ProjectFile[]; conversation?: Conversation }) {
  const name = slug(opts.title);
  const blob = buildZip(zipEntriesFor(opts.title, opts.files, opts.conversation));
  downloadBlob(blob, `${name}.zip`);
}

export function exportGithubBundle(opts: { title: string; files: ProjectFile[]; conversation?: Conversation }) {
  const name = slug(opts.title);
  const extra: ZipEntry[] = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name,
          private: true,
          version: "1.0.0",
          type: "module",
          scripts: { dev: "vite", build: "vite build" },
        },
        null,
        2,
      ),
    },
    {
      path: ".gitignore",
      content: "node_modules\ndist\n.DS_Store\n",
    },
  ];
  const existing = new Set(opts.files.map((f) => f.path));
  const files = [
    ...opts.files,
    ...extra
      .filter((e) => !existing.has(e.path))
      .map((e) => ({ path: e.path, language: "text", content: e.content })),
  ];
  const blob = buildZip(zipEntriesFor(opts.title, files, opts.conversation));
  downloadBlob(blob, `${name}-github.zip`);
}

export function exportNetworkBackup(payload: { conversations: Conversation[]; projects: SavedProject[] }) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `ats-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function copySharePayload(data: unknown) {
  const json = JSON.stringify(data);
  const encoded = await compressToParam(json);
  const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
  await navigator.clipboard.writeText(url);
  return url;
}

export async function compressToParam(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function decompressParam(param: string) {
  const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}
