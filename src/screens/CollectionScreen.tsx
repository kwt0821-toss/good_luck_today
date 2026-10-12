import { DexScreen } from "./DexScreen";

type CollectionScreenProps = {
  onBack: () => void;
  floatingToast?: string | null;
};

export function CollectionScreen({ onBack, floatingToast = null }: CollectionScreenProps) {
  return <DexScreen onBack={onBack} floatingToast={floatingToast} />;
}
