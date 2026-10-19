import { useBackHandler } from "../hooks/useBackHandler";

type StubScreenProps = {
  title: string;
  body: string;
  onBack: () => void;
};

export function StubScreen({ title, body, onBack }: StubScreenProps) {
  useBackHandler(true, onBack);
  return (
    <div className="screen">
      <h1 className="stub-title">{title}</h1>
      <p className="stub-copy">{body}</p>
    </div>
  );
}
