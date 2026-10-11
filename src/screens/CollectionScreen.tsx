import type { UserState } from "../types";

import { DexScreen } from "./DexScreen";

type CollectionScreenProps = {
  user: UserState;
  onBack: () => void;
};

export function CollectionScreen({ onBack }: CollectionScreenProps) {
  return <DexScreen onBack={onBack} />;
}
