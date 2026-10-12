import type { OpsState } from "../lib/opsTypes";
import { DexScreen } from "./DexScreen";

type CollectionScreenProps = {
  onBack: () => void;
  ops: OpsState;
  onOpsChange: (next: OpsState) => void;
  floatingToast?: string | null;
};

export function CollectionScreen({
  onBack,
  ops,
  onOpsChange,
  floatingToast = null,
}: CollectionScreenProps) {
  return (
    <DexScreen
      onBack={onBack}
      ops={ops}
      onOpsChange={onOpsChange}
      floatingToast={floatingToast}
    />
  );
}
