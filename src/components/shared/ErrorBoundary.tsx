import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  /** Friendly title shown above the error message. */
  title?: string;
  /**
   * Render-prop fallback. Receives the captured error and a reset() callback
   * that clears the boundary so children re-mount on the next render.
   * If omitted, a minimal default panel is rendered.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Local error boundary used to keep the surrounding chrome (sidebar, top bar)
 * visible when a single page subtree throws during render. Without this, an
 * unhandled exception in a page component (e.g. the Setup GCP page when its
 * sidecar is unreachable and the API returns an unexpected payload) unmounts
 * the entire React tree and the browser tab goes blank.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const err = error instanceof Error ? error : new Error(String(error));
    return { error: err };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Console-only — we intentionally do not exfiltrate this anywhere.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught render error", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{this.props.title ?? "Something went wrong"}</p>
            <p className="mt-1 break-words text-xs opacity-90">{error.message}</p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
