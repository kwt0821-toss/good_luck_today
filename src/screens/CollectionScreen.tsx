import { DexScreen } from "./DexScreen";

type CollectionScreenProps = {
  onBack: () => void;
};

export function CollectionScreen({ onBack }: CollectionScreenProps) {
  return <DexScreen onBack={onBack} />;
}
