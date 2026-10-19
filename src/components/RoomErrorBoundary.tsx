import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onHome: () => void;
};

type State = {
  error: Error | null;
  nonce: number;
};

function firstStackLine(error: Error): string {
  const lines = (error.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const message = error.message.trim();
  return (
    lines.find((line) => line !== message && line !== `Error: ${message}` && !line.endsWith(`: ${message}`)) ??
    ""
  );
}

/** Catches a room crash so the rest of the app stays on its own screen. */
export class RoomErrorBoundary extends Component<Props, State> {
  state: State = { error: null, nonce: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error("알 수 없는 오류가 났어요.") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  retry = () => {
    this.setState((prev) => ({ error: null, nonce: prev.nonce + 1 }));
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return (
        <div key={this.state.nonce} className="room-error-host">
          {this.props.children}
        </div>
      );
    }
    const frame = firstStackLine(error);
    return (
      <div className="room-error" role="alert">
        <p className="room-error-title">방을 불러오지 못했어요</p>
        <div className="room-error-actions">
          <button type="button" onClick={this.retry}>
            다시 시도
          </button>
          <button type="button" className="is-ghost" onClick={this.props.onHome}>
            메인으로
          </button>
        </div>
        <small className="room-error-detail">
          {error.message}
          {frame ? <span>{frame}</span> : null}
        </small>
      </div>
    );
  }
}
