import { LoadingModal } from "./LoadingModal";
import { useLoadingHoldSnapshot } from "../lib/loadingGate";

/** One loading window for the whole app, so a short task can finish its minimum time. */
export function LoadingHost() {
  const { open, progress, messages } = useLoadingHoldSnapshot();
  return <LoadingModal open={open} progress={progress} messages={messages} />;
}
