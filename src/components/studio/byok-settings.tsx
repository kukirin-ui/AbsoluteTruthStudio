import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  BYOK_PROVIDER_LABELS,
  BYOK_PROVIDERS,
  byokErrorMessage,
  deleteByokCredential,
  listByokCredentials,
  upsertByokCredential,
  type ByokCredentialMeta,
  type ByokProvider,
} from "@/lib/byok";
import { formatRelative } from "@/lib/utils";

function providerLabel(p: ByokProvider) {
  return BYOK_PROVIDER_LABELS[p] ?? p;
}

export function ByokSettingsDrawer({
  open,
  onOpenChange,
  onCredentialsChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fired after list/add/delete so chrome can refresh hasByok badge. Meta only. */
  onCredentialsChange?: (credentials: ByokCredentialMeta[]) => void;
}) {
  const [credentials, setCredentials] = useState<ByokCredentialMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [provider, setProvider] = useState<ByokProvider>("xai");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [deleting, setDeleting] = useState<ByokProvider | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listByokCredentials();
    setLoading(false);
    if (!result.ok) {
      setCredentials([]);
      onCredentialsChange?.([]);
      setBanner(byokErrorMessage(result.error));
      return;
    }
    setBanner(null);
    setCredentials(result.credentials);
    onCredentialsChange?.(result.credentials);
  }, [onCredentialsChange]);

  useEffect(() => {
    if (!open) return;
    setSecret("");
    setLabel("");
    void refresh();
  }, [open, refresh]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pasted = secret;
    if (!pasted.trim()) {
      toast.error("Paste an API key once to save.");
      return;
    }
    setSaving(true);
    const result = await upsertByokCredential({
      provider,
      secret: pasted,
      label: label.trim() || null,
    });
    // Clear local secret immediately — never echo after submit (success or fail path below).
    setSecret("");
    setSaving(false);
    if (!result.ok) {
      toast.error(byokErrorMessage(result.error));
      if (result.error.code === "BYOK_NOT_CONFIGURED" || result.error.status === 503) {
        setBanner(byokErrorMessage(result.error));
      }
      return;
    }
    setLabel("");
    toast.success(`${providerLabel(result.meta.provider)} key saved`);
    void refresh();
  }

  async function onDelete(p: ByokProvider) {
    setDeleting(p);
    const result = await deleteByokCredential(p);
    setDeleting(null);
    if (!result.ok) {
      toast.error(byokErrorMessage(result.error));
      return;
    }
    toast.message(`${providerLabel(p)} key removed`);
    void refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="BYOK keys" className="left-auto right-0 w-[min(100%,26rem)]">
        <p className="mb-4 text-sm text-muted">
          Bring your own provider keys. Secrets are encrypted server-side. This UI only shows
          provider, label, and version — never the key itself after save.
        </p>

        {banner ? (
          <div className="mb-4 rounded-lg bg-elevated px-3 py-2 text-xs text-muted shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
            {banner}
          </div>
        ) : null}

        <section className="mb-6">
          <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
            Saved keys
          </p>
          {loading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : credentials.length === 0 ? (
            <p className="text-xs text-muted">No keys on this account yet.</p>
          ) : (
            <ul className="space-y-2">
              {credentials.map((c) => (
                <li
                  key={c.provider}
                  className="flex items-center gap-2 rounded-lg bg-panel px-3 py-2 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
                >
                  <KeyRound className="size-3.5 shrink-0 text-indigo-glow" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">
                      {providerLabel(c.provider)}
                      {c.label ? (
                        <span className="text-muted"> · {c.label}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-subtle">
                      {c.keyVersion}
                      {c.updatedAt ? ` · updated ${formatRelative(Date.parse(c.updatedAt) || Date.now())}` : ""}
                    </p>
                  </div>
                  <Badge variant="emerald">ON</Badge>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${providerLabel(c.provider)} key`}
                    disabled={deleting === c.provider}
                    onClick={() => void onDelete(c.provider)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <p className="text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
            Add or replace
          </p>
          <label className="block text-xs text-muted">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ByokProvider)}
              className="mt-1 flex h-10 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)] outline-none"
            >
              {BYOK_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {providerLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Label <span className="text-subtle">(optional)</span>
            <Input
              className="mt-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. personal"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-muted">
            API key
            <Input
              className="mt-1"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste once — cleared after save"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button type="submit" className="w-full" disabled={saving || !secret.trim()}>
            {saving ? "Saving…" : "Save key"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
