import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-zinc-950/80 border border-red-500/20 rounded-xl text-center">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
            {this.props.fallbackTitle || 'Rendering Error Intercepted'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-md leading-relaxed font-mono">
            {this.state.error?.message || 'An unexpected rendering error occurred while rendering this workspace panel.'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={14} />
            Reset Workspace View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
