import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
              An unexpected error occurred. Your data is safe. Please reload the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
