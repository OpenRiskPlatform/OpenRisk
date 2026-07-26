import { Component, type ErrorInfo, type ReactNode } from "react";

interface ResultBoundaryProps {
  children: ReactNode;
  rawOutput: string | null;
}

interface ResultBoundaryState {
  error: Error | null;
}

export class ResultBoundary extends Component<
  ResultBoundaryProps,
  ResultBoundaryState
> {
  state: ResultBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ResultBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The visible fallback is the source of truth. Do not log plugin output,
    // because it may contain sensitive investigation data.
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            This result could not be rendered.
          </p>
          <p className="text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          {this.props.rawOutput ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-xs">
              {this.props.rawOutput}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
