import { ScreenHeader } from "../components/ScreenHeader";

type StubScreenProps = {
  title: string;
  body: string;
  onBack: () => void;
};

export function StubScreen({ title, body, onBack }: StubScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title={title} showBack onBack={onBack} pinkJellyBalance={0} />
      <p className="stub-copy">{body}</p>
    </div>
  );
}
