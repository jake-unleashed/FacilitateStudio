import React from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary - Catches unexpected runtime errors and shows a recoverable UI.
 *
 * This is primarily for demo robustness: instead of a blank screen, users can reload
 * or return home.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep logging for debugging; avoid throwing from here.
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.assign('/');
  };

  private handleTryAgain = () => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    const message =
      this.state.error?.message?.trim() || 'Something went wrong while rendering this page.';

    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-xl rounded-[32px] border border-white/40 bg-white/80 p-6 shadow-glass backdrop-blur-xl">
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>

          <details className="mt-4 rounded-[20px] border border-white/50 bg-white/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Technical details
            </summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
              {this.state.error?.stack || message}
            </pre>
          </details>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" size="md" onClick={this.handleTryAgain}>
              Try again
            </Button>
            <Button variant="secondary" size="md" onClick={this.handleGoHome}>
              Go home
            </Button>
            <Button variant="primary" size="md" onClick={this.handleReload}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

