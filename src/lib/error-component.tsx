import { Component, type ErrorInfo, type ReactNode } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "The studio hit a snag. Reload to continue.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function resetStudio() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("ats-studio")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  window.location.reload();
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <TriangleAlert className="size-10 text-warn" strokeWidth={2} />
      <h1 className="text-lg font-semibold">Studio paused</h1>
      <p className="max-w-md text-sm break-words text-muted">{message}</p>
      <button
        type="button"
        className="mt-2 rounded-full bg-indigo px-4 py-2 text-sm text-white"
        onClick={resetStudio}
      >
        Reset and reload
      </button>
    </main>
  );
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorView message={errorMessage(error)} />;
}

export class StudioGuard extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* recovered in UI */
  }

  render() {
    if (this.state.error) {
      return <ErrorView message="The last run crashed the view." />;
    }
    return this.props.children;
  }
}