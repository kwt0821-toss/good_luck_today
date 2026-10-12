import type { OpsState } from "../lib/opsTypes";
import { DexScreen, type DexTutorialPhase } from "./DexScreen";

type CollectionScreenProps = {
  onBack: () => void;
  ops: OpsState;
  onOpsChange: (next: OpsState) => void;
  floatingToast?: string | null;
  focusCardId?: string | null;
  tutorialPhase?: DexTutorialPhase;
  reduceMotion?: boolean;
  onTutorialScrollDone?: () => void;
  onTutorialClaimed?: () => void;
};

export function CollectionScreen({
  onBack,
  ops,
  onOpsChange,
  floatingToast = null,
  focusCardId = null,
  tutorialPhase = null,
  reduceMotion = false,
  onTutorialScrollDone,
  onTutorialClaimed,
}: CollectionScreenProps) {
  return (
    <DexScreen
      onBack={onBack}
      ops={ops}
      onOpsChange={onOpsChange}
      floatingToast={floatingToast}
      focusCardId={focusCardId}
      tutorialPhase={tutorialPhase}
      reduceMotion={reduceMotion}
      onTutorialScrollDone={onTutorialScrollDone}
      onTutorialClaimed={onTutorialClaimed}
    />
  );
}
