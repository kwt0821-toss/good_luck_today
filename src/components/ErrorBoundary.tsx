import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "알 수 없는 오류가 났어요." };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <div className="boot-error">
        <p>화면을 불러오지 못했어요.</p>
        <small>{this.state.message}</small>
        <button type="button" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    );
  }
}
